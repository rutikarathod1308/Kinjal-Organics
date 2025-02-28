import frappe
from frappe import _

def update_sales_order(doc=None, method=None):
    """Trigger background job to update pending qty for a Sales Order."""
    frappe.enqueue(update_pending_qty, queue="long", doc_name=doc.name)
    frappe.msgprint("Hello")

def update_pending_qty(doc_name):
    """Update the pending quantity for each item in the Sales Order."""
    doc = frappe.get_doc("Sales Order", doc_name)  # Fetch the latest document

    for item in doc.items:
        updated_delivered_qty = frappe.db.get_value("Sales Order Item", item.name, "delivered_qty")  # Fetch latest delivered qty
        pending_qty = item.qty - updated_delivered_qty  # Calculate pending qty

        frappe.db.set_value("Sales Order Item", item.name, "custom_pending_qty", pending_qty)
    frappe.msgprint("Hello Its Work")
    frappe.db.commit()  # Ensure DB changes are saved
    frappe.logger().info(f"Pending quantity updated for Sales Order {doc_name}")

def cancel_delivery_note(doc=None,method=None):
    frappe.enqueue(cancel_pending_qty, queue="long", doc=doc.name)
    
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