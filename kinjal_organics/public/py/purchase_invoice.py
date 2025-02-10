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