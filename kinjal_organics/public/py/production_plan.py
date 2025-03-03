
import copy
import json
import math
import frappe
from frappe import _, msgprint
from frappe.model.document import Document
from frappe.query_builder.functions import IfNull, Sum
from frappe.utils import (
	add_days,
	ceil,
	cint,
	comma_and,
	flt,
	get_link_to_form,
	getdate,
	now_datetime,
	nowdate,
)
from frappe.utils.csvutils import build_csv_response
from pypika.terms import ExistsCriterion

from erpnext.manufacturing.doctype.bom.bom import get_children as get_bom_children
from erpnext.manufacturing.doctype.bom.bom import validate_bom_no
from erpnext.manufacturing.doctype.work_order.work_order import get_item_details
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from erpnext.stock.get_item_details import get_conversion_factor
from erpnext.stock.utils import get_or_make_bin
from erpnext.utilities.transaction_base import validate_uom_is_integer
from erpnext.manufacturing.doctype.production_plan.production_plan import ProductionPlan
from erpnext.manufacturing.doctype.production_plan.production_plan import set_default_warehouses
from chemical.chemical.doc_events.production_plan import CustomProductionPlan as _ProductionPlan 
class custom_ProductionPlan_over(_ProductionPlan):
	def on_submit(self):
    
		self.update_bin_qty()
		self.update_sales_order()
		self.make_work_order()

	def make_work_order_for_finished_goods(self, wo_list, default_warehouses):
		items_data = self.get_production_items()

		for _key, item in items_data.items():
			if self.sub_assembly_items:
				item["use_multi_level_bom"] = 0

			set_default_warehouses(item, default_warehouses)
			work_order = self.create_work_order(item)
			if work_order:
				wo_list.append(work_order)
			wo = frappe.get_doc("Work Order", work_order)
			wo.source_warehouse = item.get("source_warehouse")
			for req_item in wo.required_items:
				req_item.source_warehouse = item.get("source_warehouse")
			wo.submit()
	def make_work_order_for_subassembly_items(self, wo_list, subcontracted_po, default_warehouses):
		for row in self.sub_assembly_items:
			if row.type_of_manufacturing == "Subcontract":
				subcontracted_po.setdefault(row.supplier, []).append(row)
				continue

			if row.type_of_manufacturing == "Material Request":
				continue

			work_order_data = {
				"wip_warehouse": default_warehouses.get("wip_warehouse"),
				"fg_warehouse": default_warehouses.get("fg_warehouse"),
				"company": self.get("company"),
			}
			self.prepare_data_for_sub_assembly_items(row, work_order_data)
			work_order = self.create_work_order(work_order_data)
			if work_order:
				wo_list.append(work_order)
			wo = frappe.get_doc("Work Order", work_order)
			for req_item in wo.required_items:
				req_item.source_warehouse = row.get("source_warehouse")
			wo.submit()
	def get_production_items(self):
		item_dict = {}
		for d in self.po_items:
			item_details = {
				"production_item": d.item_code,
				"use_multi_level_bom": d.include_exploded_items,
				"sales_order": d.sales_order,
				"sales_order_item": d.sales_order_item,
				"material_request": d.material_request,
				"material_request_item": d.material_request_item,
				"bom_no": d.bom_no,
				"description": d.description,
				"stock_uom": d.stock_uom,
				"company": self.company,
				"fg_warehouse": d.target_warehouse,
				"source_warehouse":d.source_warehouse,
				"production_plan": self.name,
				"production_plan_item": d.name,
				"product_bundle_item": d.product_bundle_item,
				"planned_start_date": d.planned_start_date,
				"project": self.project,
			}

			key = (d.item_code, d.sales_order, d.warehouse, d.name)
			if not d.sales_order:
				key = (d.name, d.item_code, d.warehouse, d.name)

			if not item_details["project"] and d.sales_order:
				item_details["project"] = frappe.get_cached_value("Sales Order", d.sales_order, "project")

			if self.get_items_from == "Material Request":
				item_details.update({"qty": d.planned_qty})
				item_dict[(d.item_code, d.name, d.warehouse)] = item_details
			else:
				item_details.update(
					{"qty": flt(item_dict.get(key, {}).get("qty")) + (flt(d.planned_qty) - flt(d.ordered_qty))}
				)
				item_dict[key] = item_details

		return item_dict
	@frappe.whitelist()
	def get_sub_assembly_items(self, manufacturing_type=None):
		"Fetch sub assembly items and optionally combine them."
		self.sub_assembly_items = []
		sub_assembly_items_store = []  # temporary store to process all subassembly items
		
		for row in self.po_items:
			if self.skip_available_sub_assembly_item and not self.sub_assembly_warehouse:
				frappe.throw(_("Row #{0}: Please select the Sub Assembly Warehouse").format(row.idx))

			if not row.item_code:
				frappe.throw(_("Row #{0}: Please select Item Code in Assembly Items").format(row.idx))

			if not row.bom_no:
				frappe.throw(_("Row #{0}: Please select the BOM No in Assembly Items").format(row.idx))

			bom_data = []
			item_data = []
			
			warehouse = (self.sub_assembly_warehouse) if self.skip_available_sub_assembly_item else None
			get_sub_assembly_items(row.bom_no, item_data, row.planned_qty, self.company, warehouse=warehouse)
			self.set_sub_assembly_items_based_on_level(row, item_data, manufacturing_type)
			sub_assembly_items_store.extend(item_data)

		if not sub_assembly_items_store and self.skip_available_sub_assembly_item:
			message = (
				_(
					"As there are sufficient Sub Assembly Items, Work Order is not required for Warehouse {0}."
				).format(self.sub_assembly_warehouse)
				+ "<br><br>"
			)
			message += _(
				"If you still want to proceed, please disable 'Skip Available Sub Assembly Items' checkbox."
			)

			frappe.msgprint(message, title=_("Note"))

		if self.combine_sub_items:
			# Combine subassembly items
			items_data_value = []
			for item in self.combine_subassembly_items(sub_assembly_items_store) :
				items_len = max(1, math.ceil(item.stock_qty / item.parent_item_qty))
				remaining_qty = item.stock_qty

				for _ in range(items_len):
					if remaining_qty >= item.parent_item_qty:
						remaining_qty -= item.parent_item_qty
						items_data_value.append(
						frappe._dict(
						{
							"parent_item_code":item.parent_item_code,
							"description": item.description,
							"production_item":item.production_item,
							"item_name":item.item_name,
							"stock_uom": item.stock_uom,
							"uom": item.uom,
							"bom_no":item.bom_no,
							"is_sub_contracted_item": item.is_sub_contracted_item,
							"bom_level":item.bom_level,
							"indent":item.indent,
							"qty": item.parent_item_qty
							
							# "total_qty" : item_list["total_qty"],
						}
      					)	
					)
					else :
						items_data_value.append(
						frappe._dict(
						{
							"parent_item_code":item.parent_item_code,
							"description": item.description,
							"production_item":item.production_item,
							"item_name":item.item_name,
							"stock_uom": item.stock_uom,
							"uom": item.uom,
							"bom_no":item.bom_no,
							"is_sub_contracted_item": item.is_sub_contracted_item,
							"bom_level":item.bom_level,
							"indent":item.indent,
							"qty": remaining_qty,
       						
							
							# "total_qty" : item_list["total_qty"],
						}
      					)	
					)
			sub_assembly_items_store = items_data_value
			# frappe.msgprint(str(items_data_value))
		for idx, row in enumerate(sub_assembly_items_store):
			row.idx = idx + 1
			self.append("sub_assembly_items", row)

		self.set_default_supplier_for_subcontracting_order()
def get_sub_assembly_items(bom_no, item_data, to_produce_qty, company, warehouse=None, indent=0):
	data = get_bom_children(parent=bom_no)
	item = []
	for d in data:
		if d.expandable:
			parent_item_code = frappe.get_cached_value("BOM", bom_no, "item")
			stock_qty = (d.stock_qty / d.parent_bom_qty) * flt(to_produce_qty)
			parent_item_qty = frappe.get_cached_value("BOM", d.value, "quantity")
			
			if warehouse:
				bin_details = get_bin_details(d, company, for_warehouse=warehouse)

				for _bin_dict in bin_details:
					if _bin_dict.projected_qty > 0:
						if _bin_dict.projected_qty > stock_qty:
							stock_qty = 0
							continue
						else:
							stock_qty = stock_qty - _bin_dict.projected_qty

			item_len = max(1, math.ceil(stock_qty / parent_item_qty))
			
			remaining_qty = stock_qty
			# frappe.msgprint(str(item_len))
			for _ in range(item_len):
				if remaining_qty >= parent_item_qty:
					remaining_qty -= parent_item_qty
					
					item.append({
						"parent_item_code": parent_item_code,
							"description": d.description,
							"production_item": d.item_code,
							"item_name": d.item_name,
							"stock_uom": d.stock_uom,
							"uom": d.stock_uom,
							"bom_no": d.value,
							"is_sub_contracted_item": d.is_sub_contracted_item,
							"bom_level": indent,
							"indent": indent,
							"stock_qty": parent_item_qty,
							"parent_item_qty" : parent_item_qty,
							
					})
				else:
					
					item.append({
							"parent_item_code": parent_item_code,
							"description": d.description,
							"production_item": d.item_code,
							"item_name": d.item_name,
							"stock_uom": d.stock_uom,
							"uom": d.stock_uom,
							"bom_no": d.value,
							"is_sub_contracted_item": d.is_sub_contracted_item,
							"bom_level": indent,
							"indent": indent,
							"stock_qty": remaining_qty,
							"parent_item_qty" : parent_item_qty,
						
						})
			for item_list in item:
				if stock_qty > 0 :
					item_data.append(
					frappe._dict(
						{
							"parent_item_code":item_list["parent_item_code"],
							"description": item_list["description"],
							"production_item":item_list["production_item"],
							"item_name":item_list["item_name"],
							"stock_uom": item_list["stock_uom"],
							"uom": item_list["uom"],
							"bom_no":item_list["bom_no"],
							"is_sub_contracted_item": item_list["is_sub_contracted_item"],
							"bom_level": item_list["bom_level"],
							"indent": item_list["indent"],
							"stock_qty": item_list["stock_qty"],
       						"parent_item_qty" : item_list["parent_item_qty"],
							
							# "total_qty" : item_list["total_qty"],
						}
					)
				)
				
			

			if d.value:
			
				get_sub_assembly_items(
					d.value, item_data, stock_qty, company, warehouse, indent=indent + 1
				)
@frappe.whitelist()
def get_bin_details(row, company, for_warehouse=None, all_warehouse=False):
	if isinstance(row, str):
		row = frappe._dict(json.loads(row))

	bin = frappe.qb.DocType("Bin")
	wh = frappe.qb.DocType("Warehouse")

	subquery = frappe.qb.from_(wh).select(wh.name).where(wh.company == company)

	warehouse = ""
	if not all_warehouse:
		warehouse = for_warehouse or row.get("source_warehouse") or row.get("default_warehouse")

	if warehouse:
		lft, rgt = frappe.db.get_value("Warehouse", warehouse, ["lft", "rgt"])
		subquery = subquery.where((wh.lft >= lft) & (wh.rgt <= rgt) & (wh.name == bin.warehouse))

	query = (
		frappe.qb.from_(bin)
		.select(
			bin.warehouse,
			IfNull(Sum(bin.projected_qty), 0).as_("projected_qty"),
			IfNull(Sum(bin.actual_qty), 0).as_("actual_qty"),
			IfNull(Sum(bin.ordered_qty), 0).as_("ordered_qty"),
			IfNull(Sum(bin.reserved_qty_for_production), 0).as_("reserved_qty_for_production"),
			IfNull(Sum(bin.planned_qty), 0).as_("planned_qty"),
		)
		.where((bin.item_code == row["item_code"]) & (bin.warehouse.isin(subquery)))
		.groupby(bin.item_code, bin.warehouse)
	)

	return query.run(as_dict=True)



#Override Production Plan Functions
@frappe.whitelist()
def override_proplan_functions():

	ProductionPlan.get_open_sales_orders = get_open_sales_orders
	ProductionPlan.get_items = get_items_from_sample
	# ProductionPlan.show_list_created_message = show_list_created_message
	# ProductionPlan.make_work_order = make_work_order


# @frappe.whitelist()
# def create_work_order(self, item):
# 	from erpnext.manufacturing.doctype.work_order.work_order import OverProductionError
	
# 	work_order_names = []
# 	if flt(item.get("qty")) <= 0:
# 		return

# 	bom_quantity = frappe.get_value("BOM", item.get("bom_no"), "quantity")

# 	if not bom_quantity or bom_quantity <= 0:
# 		return

# 	sales_order_qty = item.get("qty")
# 	for row in self.po_items:
# 		try:
# 			# Calculate the quantity for each work order
# 			wo_qty = min(sales_order_qty, bom_quantity)
# 			sales_order_qty -= wo_qty

# 			# Create a new work order for each row in po_items
# 			wo = frappe.new_doc("Work Order")
# 			wo.update(item)
# 			wo.planned_start_date = item.get("planned_start_date") or item.get("schedule_date")

# 			if item.get("warehouse"):
# 				wo.fg_warehouse = item.get("warehouse")

# 			wo.set_work_order_operations()
# 			wo.set_required_items()
# 			wo.qty = wo_qty  # Set the calculated quantity for the work order

# 			wo.flags.ignore_mandatory = True
# 			wo.flags.ignore_validate = True
# 			wo.insert()
# 			# wo.save()
# 			work_order_names.append(wo.name)

# 		except OverProductionError:
# 			pass

# 	return work_order_names  # You may want to return the last work order name outside the loop


def get_sales_orders(self):
	so_filter = item_filter = ""
	if self.from_date:
		so_filter += " and so.transaction_date >= %(from_date)s"
	if self.to_date:
		so_filter += " and so.transaction_date <= %(to_date)s"
	if self.customer:
		so_filter += " and so.customer = %(customer)s"
	if self.project:
		so_filter += " and so.project = %(project)s"
	if self.from_delivery_date:
		item_filter += " and so_item.delivery_date >= %(from_delivery_date)s"
	if self.to_delivery_date:
		item_filter += " and so_item.delivery_date <= %(to_delivery_date)s"

	if self.item_code:
		item_filter += " and so_item.item_code = %(item)s"

	open_so = frappe.db.sql("""
		select distinct so.name, so.transaction_date, so.customer, so.base_grand_total
		from `tabSales Order` so, `tabSales Order Item` so_item
		where so_item.parent = so.name
			and so.docstatus = 1 and so.status not in ("Stopped", "Closed","Completed")
			and so.company = %(company)s
			and so_item.qty > so_item.work_order_qty {0} {1}

		""".format(so_filter, item_filter), {
			"from_date": self.from_date,
			"to_date": self.to_date,
			"customer": self.customer,
			"project": self.project,
			"item": self.item_code,
			"company": self.company,
			"from_delivery_date": self.from_delivery_date,
			"to_delivery_date": self.to_delivery_date

		}, as_dict=1)

	return open_so
@frappe.whitelist()
def get_open_sales_orders(self):
		""" Pull sales orders  which are pending to deliver based on criteria selected"""
		open_so = get_sales_orders(self)
		if open_so:
			self.add_so_in_table(open_so)
		else:
			frappe.msgprint(_("Sales orders are not available for production"))

@frappe.whitelist()
def get_items_from_sample(self):
	if self.get_items_from == "Sales Order":
		if self.based_on_sample == 1:
			get_so_items_for_sample(self)
		else:
			get_so_items(self)
	elif self.get_items_from == "Material Request":
			get_mr_items(self)

def get_so_items_for_sample(self):
		so_list = [d.sales_order for d in self.get("sales_orders", []) if d.sales_order]
		if not so_list:
			msgprint(_("Please enter Sales Orders in the above table"))
			return []
		item_condition = ""
		if self.item_code:
			item_condition = ' and so_item.item_code = "{0}"'.format(frappe.db.escape(self.item_code))
	# -----------------------	custom added code  ------------#

		if self.as_per_projected_qty == 1:                                                           #condition 1
			sample_list = [[d.outward_sample, d.quantity ,d.projected_qty] for d in self.get("finish_items", []) if d.outward_sample]	
			if not sample_list:
				frappe.msgprint(_("Please Get Finished Items."))
				return []	
			item_details = frappe._dict()

			for sample, quantity ,projected_qty in sample_list:#changes here
				if projected_qty < 0:
					sample_doc = frappe.get_doc("Outward Sample",sample)
					for row in sample_doc.details:
						bom_no = frappe.db.exists("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
						
						if bom_no:
							bom = frappe.get_doc("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
							item_details.setdefault(row.item_code, frappe._dict({
								'planned_qty': 0.0,
								'bom_no': bom.name,
								'item_code': row.item_code,
								'concentration' : bom.concentration
							}))
							
							item_details[row.item_code].planned_qty += (flt(abs(projected_qty)) * flt(row.quantity) * flt(row.concentration))/ (flt(sample_doc.total_qty) * flt(bom.concentration) )
			
			items = [values for values in item_details.values()]

		elif self.as_per_actual_qty == 1:															 #condition 2
			
			sample_list = [[d.outward_sample, d.quantity,d.actual_qty] for d in self.get("finish_items", []) if d.outward_sample]	
			if not sample_list:
				frappe.msgprint(_("Please Get Finished Items."))
				return []	
			item_details = frappe._dict()
			for sample, quantity, actual_qty in sample_list:
				diff = actual_qty - quantity #changes here
				if diff < 0:
					sample_doc = frappe.get_doc("Outward Sample",sample)

					for row in sample_doc.details:
						bom_no = frappe.db.exists("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
						if bom_no:
							bom = frappe.get_doc("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
							item_details.setdefault(row.item_code, frappe._dict({
								'planned_qty': 0.0,
								'bom_no': bom.name,
								'item_code': row.item_code,
								'concentration' : bom.concentration
							}))
							
							item_details[row.item_code].planned_qty += (flt(abs(diff)) * flt(row.quantity) * flt(row.concentration)) / (flt(sample_doc.total_qty) * flt(bom.concentration))
							
			items = [values for values in item_details.values()]

		elif self.based_on_sample == 1:		

			sample_list = [[d.outward_sample, d.quantity] for d in self.get("finish_items", []) if d.outward_sample]	
			if not sample_list:
				frappe.msgprint(_("Please Get Finished Items."))
				return []	
			item_details = frappe._dict()
			for sample, quantity in sample_list:
				sample_doc = frappe.get_doc("Outward Sample",sample)

				for row in sample_doc.details:
					bom_no = frappe.db.exists("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
					if bom_no:
						bom = frappe.get_doc("BOM", {'item':row.item_code,'is_active':1,'is_default':1,'docstatus':1})
						# frappe.msgprint(str(bom.name))
					
						item_details.setdefault(row.item_code, frappe._dict({
							'planned_qty': 0.0,
							'bom_no': bom.name,
							'item_code': row.item_code,
							'concentration' : bom.concentration
						}))
						
						item_details[row.item_code].planned_qty += (flt(quantity) * flt(row.quantity) * (row.concentration))/ (flt(sample_doc.total_qty)* (bom.concentration))

			items = [values for values in item_details.values()]
		else:
			return	
	# -----------------------	
		# items = frappe.db.sql("""select distinct parent, item_code, warehouse,
		# 	(qty - work_order_qty) * conversion_factor as pending_qty, name
		# 	from `tabSales Order Item` so_item
		# 	where parent in (%s) and docstatus = 1 and qty > work_order_qty
		# 	and exists (select name from `tabBOM` bom where bom.item=so_item.item_code
		# 			and bom.is_active = 1) %s""" % \
		# 	(", ".join(["%s"] * len(so_list)), item_condition), tuple(so_list), as_dict=1)

		if self.item_code:
			item_condition = ' and so_item.item_code = "{0}"'.format(frappe.db.escape(self.item_code))

		packed_items = frappe.db.sql("""select distinct pi.parent, pi.item_code, pi.warehouse as warehouse,
			(((so_item.qty - so_item.work_order_qty) * pi.qty) / so_item.qty)
				as pending_qty, pi.parent_item, so_item.name
			from `tabSales Order Item` so_item, `tabPacked Item` pi
			where so_item.parent = pi.parent and so_item.docstatus = 1
			and pi.parent_item = so_item.item_code
			and so_item.parent in (%s) and so_item.qty > so_item.work_order_qty
			and exists (select name from `tabBOM` bom where bom.item=pi.item_code
					and bom.is_active = 1) %s""" % \
			(", ".join(["%s"] * len(so_list)), item_condition), tuple(so_list), as_dict=1)

		add_items_for_sample(self,items + packed_items)
		calculate_total_planned_qty(self)

def get_so_items(self):
		# Check for empty table or empty rows
		if not self.get("sales_orders") or not self.get_so_mr_list("sales_order", "sales_orders"):
			frappe.throw(_("Please fill the Sales Orders table"), title=_("Sales Orders Required"))

		so_list = self.get_so_mr_list("sales_order", "sales_orders")

		bom = frappe.qb.DocType("BOM")
		so_item = frappe.qb.DocType("Sales Order Item")

		items_subquery = frappe.qb.from_(bom).select(bom.name).where(bom.is_active == 1)
		items_query = (
			frappe.qb.from_(so_item)
			.select(
				so_item.parent,
				so_item.item_code,
				so_item.warehouse,
				(
					(so_item.qty - so_item.work_order_qty - so_item.delivered_qty) * so_item.conversion_factor
				).as_("pending_qty"),
				so_item.description,
				so_item.name,
				so_item.bom_no,
			)
			.distinct()
			.where(
				(so_item.parent.isin(so_list))
				& (so_item.docstatus == 1)
				& (so_item.qty > so_item.work_order_qty)
			)
		)
		if self.from_delivery_date and self.to_delivery_date:
			items_query = items_query.where(
				(so_item.delivery_date >= self.from_delivery_date) & (so_item.delivery_date <= self.to_delivery_date)
			)

		if self.item_code and frappe.db.exists("Item", self.item_code):
			items_query = items_query.where(so_item.item_code == self.item_code)
			items_subquery = items_subquery.where(
				self.get_bom_item_condition() or bom.item == so_item.item_code
			)

		items_query = items_query.where(ExistsCriterion(items_subquery))
		items = items_query.run(as_dict=True)
	
		pi = frappe.qb.DocType("Packed Item")

		packed_items_query = (
			frappe.qb.from_(so_item)
			.from_(pi)
			.select(
				pi.parent,
				pi.item_code,
				pi.warehouse.as_("warehouse"),
				(((so_item.qty - so_item.work_order_qty) * pi.qty) / so_item.qty).as_("pending_qty"),
				pi.parent_item,
				pi.description,
				so_item.name,
			)
			.distinct()
			.where(
				(so_item.parent == pi.parent)
				& (so_item.docstatus == 1)
				& (pi.parent_item == so_item.item_code)
				& (so_item.parent.isin(so_list))
				& (so_item.qty > so_item.work_order_qty)
				& (
					ExistsCriterion(
						frappe.qb.from_(bom)
						.select(bom.name)
						.where((bom.item == pi.item_code) & (bom.is_active == 1))
					)
				)
			)
		)

		if self.item_code:
			packed_items_query = packed_items_query.where(so_item.item_code == self.item_code)

		packed_items = packed_items_query.run(as_dict=True)
		
		all_items = items + packed_items
		new_items = []

		for item in all_items:
			bom_quantity = frappe.get_value("BOM", item.get("bom_no"), "quantity")
			if bom_quantity:
				# Calculate the number of rows needed based on BOM quantity
				pending_qty = item.get("pending_qty")
				while pending_qty > 0:
					qty_to_add = min(pending_qty, bom_quantity)
					new_item = item.copy()
					new_item["pending_qty"] = qty_to_add
					new_items.append(new_item)
					pending_qty -= qty_to_add
			else:
				new_items.append(item)

		self.add_items(new_items)
		# self.add_items(items + packed_items)
		self.calculate_total_planned_qty()

def get_mr_items(self):
		# Check for empty table or empty rows
		if not self.get("material_requests") or not self.get_so_mr_list(
			"material_request", "material_requests"
		):
			frappe.throw(
				_("Please fill the Material Requests table"), title=_("Material Requests Required")
			)

		mr_list = self.get_so_mr_list("material_request", "material_requests")

		bom = frappe.qb.DocType("BOM")
		mr_item = frappe.qb.DocType("Material Request Item")

		items_query = (
			frappe.qb.from_(mr_item)
			.select(
				mr_item.parent,
				mr_item.name,
				mr_item.item_code,
				mr_item.warehouse,
				mr_item.description,
				mr_item.bom_no,
				((mr_item.qty - mr_item.ordered_qty) * mr_item.conversion_factor).as_("pending_qty"),
			)
			.distinct()
			.where(
				(mr_item.parent.isin(mr_list))
				& (mr_item.docstatus == 1)
				& (mr_item.qty > mr_item.ordered_qty)
				& (
					ExistsCriterion(
						frappe.qb.from_(bom)
						.select(bom.name)
						.where((bom.item == mr_item.item_code) & (bom.is_active == 1))
					)
				)
			)
		)

		if self.item_code:
			items_query = items_query.where(mr_item.item_code == self.item_code)

		items = items_query.run(as_dict=True)
		all_items = items
		new_items = []

		for item in all_items:
			bom_quantity = frappe.get_value("BOM", item.get("bom_no"), "quantity")
			if bom_quantity:
				# Calculate the number of rows needed based on BOM quantity
				pending_qty = item.get("pending_qty")
				while pending_qty > 0:
					qty_to_add = min(pending_qty, bom_quantity)
					new_item = item.copy()
					new_item["pending_qty"] = qty_to_add
					new_items.append(new_item)
					pending_qty -= qty_to_add
			else:
				new_items.append(item)

		self.add_items(new_items)

		self.calculate_total_planned_qty()


def add_items_for_sample(self, items):
	# frappe.msgprint("call add")
	self.set('po_items', [])
	for data in items:
		item_details = get_item_details(data.item_code)
		pi = self.append('po_items', {
			'include_exploded_items': 1,
			'warehouse': data.warehouse,
			'item_code': data.item_code,
			'description': item_details and item_details.description or '',
			'stock_uom': item_details and item_details.stock_uom or '',
			'bom_no': item_details and item_details.bom_no or '',
			# 'planned_qty': data.pending_qty, 
			'concentration': data.concentration,
			'planned_qty':data.planned_qty,
			'pending_qty': data.pending_qty,
			'planned_start_date': now_datetime(),
			'product_bundle_item': data.parent_item
		})

		if self.get_items_from == "Sales Order":
			pi.sales_order = data.parent
			pi.sales_order_item = data.name

		elif self.get_items_from == "Material Request":
			pi.material_request = data.parent
			pi.material_request_item = data.name

def calculate_total_planned_qty(self):
		self.total_planned_qty = 0
		for d in self.po_items:
			self.total_planned_qty += flt(d.planned_qty)

