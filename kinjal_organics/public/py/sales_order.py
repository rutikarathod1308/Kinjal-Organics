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
