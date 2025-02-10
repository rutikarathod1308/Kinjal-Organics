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