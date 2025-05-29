import frappe
from frappe import _

def update_purchase_invoice(doc=None, method=None):
    frappe.enqueue(update_pending_qty, queue="long", doc=doc.name)
    
def cancel_purchase_invoice(doc=None,method=None):
    frappe.enqueue(cancel_pending_qty, queue="long", doc=doc.name)

def update_pending_qty(doc):
    doc = frappe.get_doc("Purchase Invoice", doc)  # Fetch latest document
    if doc.update_stock :
        
        for item in doc.items:
            purchase_order_items = frappe.get_all(
                "Purchase Order Item",
                filters={"parent": item.purchase_order, "item_code": item.item_code},  # Ensure matching item
                fields=["name", "item_code", "qty", "received_qty"]
            )
            
            for po_item in purchase_order_items:
                updated_received_qty = frappe.db.get_value("Purchase Order Item", po_item.name, "received_qty")  # Fetch latest value
                
                pending_qty = po_item.qty - updated_received_qty  # Corrected formula
                
                frappe.db.set_value("Purchase Order Item", po_item.name, "custom_pending_qty", pending_qty)
                frappe.msgprint(f"Updated Pending Qty for {po_item.item_code}: {pending_qty}")


def cancel_pending_qty(doc):
    doc = frappe.get_doc("Purchase Invoice", doc)  # Fetch latest document
    if doc.update_stock :
        for item in doc.items:
            purchase_order_items = frappe.get_all(
                "Purchase Order Item",
                filters={"parent": item.purchase_order, "item_code": item.item_code},  # Ensure matching item
                fields=["name", "item_code", "qty", "custom_pending_qty"]
            )
            
            for po_item in purchase_order_items:
                updated_received_qty = frappe.db.get_value("Purchase Order Item", po_item.name, "received_qty")  # Fetch latest value
                
                pending_qty = po_item.custom_pending_qty + item.qty  # Corrected formula
                
                frappe.db.set_value("Purchase Order Item", po_item.name, "custom_pending_qty", pending_qty)
                frappe.msgprint(f"Updated Pending Qty for {po_item.item_code}: {pending_qty}")
                
import json

import frappe
from frappe import _, msgprint
from frappe.desk.notifications import clear_doctype_notifications
from frappe.model.mapper import get_mapped_doc
from frappe.utils import cint, cstr, flt


          
@frappe.whitelist()
def make_purchase_invoice(source_name, target_doc=None, args=None):
    def update_item(source_doc, target_doc, source_parent):
        # Ensure target quantities are derived correctly
        target_doc.qty = flt(source_doc.qty)
        target_doc.stock_qty = target_doc.qty * flt(source_doc.conversion_factor)
        target_doc.rate = flt(source_doc.rate)
        target_doc.amount = target_doc.qty * target_doc.rate
        target_doc.base_amount = target_doc.amount * flt(source_parent.conversion_rate or 1)

        # Optional: if you want to handle item group = 'Raw Materials' logic
        if args and frappe.parse_json(args).get("material_type") == "Raw":
            item_group = frappe.db.get_value("Item", source_doc.item_code, "item_group")
            if item_group != "Raw Materials":
                target_doc.ignore = True  # this will filter out item client-side
    def set_missing_values(source, target):
        # Custom logic for setting parent-level fields
        target.bill_no = source.supplier_delivery_note
        target.total_net_weight = source.total_net_weight

    doc = get_mapped_doc(
        "Purchase Receipt",
        source_name,
        {
            "Purchase Receipt": {
                "doctype": "Purchase Invoice",
                "validation": {"docstatus": ["=", 1]},
            },
            "Purchase Receipt Item": {
                "doctype": "Purchase Invoice Item",
                "field_map": {
                    "name": "purchase_receipt_item",
                    "parent": "purchase_receipt",
                    "received_qty": "qty"
                },
                "postprocess": update_item,
              
            },
            "Purchase Taxes and Charges": {
                "doctype": "Purchase Taxes and Charges",
                "add_if_empty": True,
            },
        },
        target_doc,
        set_missing_values
    )

    return doc