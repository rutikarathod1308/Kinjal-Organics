import frappe
from frappe import _

def update_sales_order(doc=None, method=None):
    """Trigger background job to update pending qty for a Sales Order."""
    frappe.enqueue(update_pending_qty, queue="long", doc_name=doc.name)
    frappe.msgprint("Hello")

def update_pending_qty(doc_name, **kwargs):  # Accept extra arguments
    """Update the pending quantity for each item in the Sales Order."""
    doc = frappe.get_doc("Sales Order", doc_name)  # Fetch the latest document

    for item in doc.items:
        updated_delivered_qty = frappe.db.get_value("Sales Order Item", item.name, "delivered_qty")  # Fetch latest delivered qty
        pending_qty = item.qty - updated_delivered_qty  # Calculate pending qty

        frappe.db.set_value("Sales Order Item", item.name, "custom_pending_qty", pending_qty)

    frappe.db.commit()  # Ensure DB changes are saved
    frappe.logger().info(f"Pending quantity updated for Sales Order {doc_name}")

def cancel_delivery_note(doc=None, method=None):
    """Trigger background job to update pending qty when Delivery Note is canceled."""
    frappe.enqueue(cancel_pending_qty, queue="long", doc_name=doc.name)

def cancel_pending_qty(doc_name, **kwargs):  # Accept extra arguments
    """Recalculate pending qty when Delivery Note is canceled."""
    doc = frappe.get_doc("Delivery Note", doc_name)  # Fetch latest document

    for item in doc.items:
        sales_order_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": item.against_sales_order, "item_code": item.item_code},  # Ensure matching item
            fields=["name", "item_code", "qty", "custom_pending_qty"]
        )

        for so_item in sales_order_items:
            pending_qty = (so_item.custom_pending_qty or 0) + item.qty  # Handle NoneType

            frappe.db.set_value("Sales Order Item", so_item.name, "custom_pending_qty", pending_qty)
            frappe.logger().info(f"Updated Pending Qty for {so_item.item_code}: {pending_qty}")

    frappe.db.commit()



from frappe.contacts.doctype.address.address import get_company_address 
from frappe.model.utils import get_fetch_values
from frappe.utils import flt, cstr
from erpnext.stock.doctype.packed_item.packed_item import make_packing_list
from erpnext.stock.doctype.item.item import get_item_defaults
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from frappe.model.mapper import get_mapped_doc
import frappe

@frappe.whitelist()
def make_sales_invoice(source_name, target_doc=None, args=None):
    def update_item(source, target, source_parent):
        target.base_amount = (flt(source.qty) - flt(source.qty)) * flt(source.base_rate)
        target.amount = (flt(source.qty) - flt(source.qty)) * flt(source.rate)
        target.qty = flt(source.qty) 
        
        if source.packing_size and source.no_of_packages:
            target.no_of_packages = target.qty / source.packing_size
        target.sales_order = source.against_sales_order
        target.cost_center = source_parent.cost_center
        target.sales_order_item = source.name
        item = get_item_defaults(target.item_code, source_parent.company)
        item_group = get_item_group_defaults(target.item_code, source_parent.company)

        # if item:
        #     target.cost_center = (
        #         frappe.db.get_value("Project", source_parent.project, "cost_center")
        #         or item.get("buying_cost_center")
        #         or item_group.get("buying_cost_center")
        #     )
    mapper = {
		"Sales Order": {"doctype": "Sales Invoice", "validation": {"docstatus": ["=", 1]}},
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
        "Delivery Note",
        source_name,
        {
            "Delivery Note": {
                "doctype": "Delivery Note",
                "validation": {"docstatus": ["=", 1]},
            },
            "Delivery Note Item": {
                "doctype": "Sales Invoice Item",
                "field_map": {
                    "name": "delivery_note_item",
                    "parent": "delivery_note",
                    "qty": "qty",
                    "name": "delivery_note_item",
                    
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