import frappe
from frappe import _

def update_delivery_note(doc=None, method=None):
    frappe.enqueue(update_pending_qty, queue="long", doc=doc.name)

def cancel_delivery_note(doc=None,method=None):
    frappe.enqueue(cancel_pending_qty, queue="long", doc=doc.name)
    
def update_pending_qty(doc):
    doc = frappe.get_doc("Delivery Note", doc)  # Fetch latest document
    for item in doc.items:
        sales_order_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": item.against_sales_order, "item_code": item.item_code},  # Ensure matching item
            fields=["name", "item_code", "qty", "delivered_qty"]
        )
        
        for so_item in sales_order_items:
            updated_delivered_qty = frappe.db.get_value("Sales Order Item", so_item.name, "delivered_qty")  # Fetch latest value
            
            pending_qty = so_item.qty - updated_delivered_qty  # Corrected formula
            
            frappe.db.set_value("Sales Order Item", so_item.name, "custom_pending_qty", pending_qty)
            frappe.msgprint(f"Updated Pending Qty for {so_item.item_code}: {pending_qty}")

def cancel_pending_qty(doc):
    doc = frappe.get_doc("Delivery Note", doc)  # Fetch latest document
   
    for item in doc.items:
        sales_order_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": item.against_sales_order, "item_code": item.item_code},  # Ensure matching item
            fields=["name", "item_code", "qty", "custom_pending_qty"]
        )
        
        for so_item in sales_order_items:
            updated_received_qty = frappe.db.get_value("Sales Order Item", so_item.name, "delivered_qty")  # Fetch latest value
            
            pending_qty = so_item.custom_pending_qty + item.qty  # Corrected formula
            
            frappe.db.set_value("Sales Order Item", so_item.name, "custom_pending_qty", pending_qty)
            frappe.msgprint(f"Updated Pending Qty for {so_item.item_code}: {pending_qty}")
            
from frappe.contacts.doctype.address.address import get_company_address 
from frappe.model.utils import get_fetch_values
from frappe.utils import flt, cstr
from erpnext.stock.doctype.packed_item.packed_item import make_packing_list
from erpnext.stock.doctype.item.item import get_item_defaults
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from frappe.model.mapper import get_mapped_doc
import frappe

# @frappe.whitelist()
# def make_delivery_note(source_name, target_doc=None, skip_item_mapping=False):
# 	def set_missing_values(source, target):
# 		target.run_method("set_missing_values")
# 		target.run_method("set_po_nos")
# 		target.run_method("calculate_taxes_and_totals")

# 		if source.company_address:
# 			target.update({"company_address": source.company_address})
# 		else:
# 			target.update(get_company_address(target.company))

# 		if target.company_address:
# 			target.update(get_fetch_values("Delivery Note", "company_address", target.company_address))

# 		make_packing_list(target)

# 	def update_item(source, target, source_parent):
# 		target.base_amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(source.base_rate)
# 		target.amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(source.rate)
# 		target.qty = flt(source.qty) - flt(source.delivered_qty)

# 		item = get_item_defaults(target.item_code, source_parent.company)
# 		item_group = get_item_group_defaults(target.item_code, source_parent.company)

# 		if item:
# 			target.cost_center = (
# 				frappe.db.get_value("Project", source_parent.project, "cost_center")
# 				or item.get("buying_cost_center")
# 				or item_group.get("buying_cost_center")
# 			)

# 	mapper = {
# 		"Sales Order": {
# 			"doctype": "Delivery Note",
# 			"validation": {"docstatus": ["=", 1]}
# 		},
# 		"Sales Taxes and Charges": {
# 			"doctype": "Sales Taxes and Charges",
# 			"add_if_empty": True
# 		},
# 		"Sales Team": {
# 			"doctype": "Sales Team",
# 			"add_if_empty": True
# 		},
# 	}

# 	if not skip_item_mapping:
# 		def condition(doc):
# 			args = frappe.flags.args or {}

# 			# Filter by item_code passed from JS
# 			if args.get("item_code") and doc.item_code != args["item_code"]:
# 				return False

# 			# Optional: filter by delivery_dates from JS
# 			if args.get("delivery_dates"):
# 				if cstr(doc.delivery_date) not in args["delivery_dates"]:
# 					return False

# 			# Default SO Item condition
# 			return abs(doc.delivered_qty) < abs(doc.qty) and doc.delivered_by_supplier != 1

# 		mapper["Sales Order Item"] = {
# 			"doctype": "Delivery Note Item",
# 			"field_map": {
# 				"rate": "rate",
# 				"name": "so_detail",
# 				"parent": "against_sales_order",
# 			},
# 			"postprocess": update_item,
# 			"condition": condition,
# 		}

# 	target_doc = get_mapped_doc("Sales Order", source_name, mapper, target_doc, set_missing_values)

# 	return target_doc


@frappe.whitelist()
def make_delivery_note(source_name, target_doc=None, args=None):
    def update_item(source, target, source_parent):
        target.base_amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(source.base_rate)
        target.amount = (flt(source.qty) - flt(source.delivered_qty)) * flt(source.rate)
        target.qty = flt(source.qty) - flt(source.delivered_qty)
       
        if source.packing_size and source.no_of_packages:
            target.no_of_packages = target.qty / source.packing_size
        target.against_sales_order = source_parent.name
        target.sales_order_item = source.name
        item = get_item_defaults(target.item_code, source_parent.company)
        item_group = get_item_group_defaults(target.item_code, source_parent.company)

        if item:
            target.cost_center = (
                frappe.db.get_value("Project", source_parent.project, "cost_center")
                or item.get("buying_cost_center")
                or item_group.get("buying_cost_center")
            )
    mapper = {
		"Sales Order": {"doctype": "Delivery Note", "validation": {"docstatus": ["=", 1]}},
		"Payment Schedule":{
			"doctype":"Payment Schedule",
			"field_map":{
				"name":"payment_schedule",
				"payment_term":"payment_term",
				"due_date":"due_date",
				"invoice_portion":"invoice_portion",
				"discount_type":"discount_type",
				"discount":"discount",
				"payment_amount":"payment_amount",
				"base_payment_amount":"base_payment_amount",
				"outstanding":"outstanding"
			}
		},
		"Sales Taxes and Charges": {"doctype": "Sales Taxes and Charges", "add_if_empty": True},
		"Sales Team": {"doctype": "Sales Team", "add_if_empty": True},
	}

    
    doc = get_mapped_doc(
        "Sales Order",
        source_name,
        {
            "Sales Order": {
                "doctype": "Delivery Note",
                "validation": {"docstatus": ["=", 1]},
            },
            "Sales Order Item": {
                "doctype": "Delivery Note Item",
                "field_map": {
                    "name": "sales_order_item",
                    "parent": "sales_order",
                    "qty": "qty",
                    "name": "so_detail"
                },
                "postprocess": update_item,
              
            },
            "Sales Taxes and Charges": {
                "doctype": "Sales Taxes and Charges",
                "add_if_empty": True,
            },
        },
        target_doc
    )

    return doc
