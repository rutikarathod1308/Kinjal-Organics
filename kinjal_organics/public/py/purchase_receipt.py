import frappe
from frappe import _
import time
from frappe.utils import flt
def update_purchase_receipt(doc=None, method=None):
    frappe.enqueue(update_pending_qty, queue="long", doc=doc.name)
    frappe.enqueue(po_qty_update, queue="long", doc=doc.name)
def cancel_purchase_receipt(doc=None,method=None):
    frappe.enqueue(cancel_pending_qty, queue="long", doc=doc.name)
    frappe.enqueue(cancel_po_qty_update, queue="long", doc=doc.name)
  

def po_qty_update(doc, method=None):
    doc = frappe.get_doc("Purchase Receipt", doc) if isinstance(doc, str) else doc
    if doc.merge_item :
        for item in doc.items:
            
            if item.purchase_order and item.purchase_order_item:
                try:
                    # Get the parent PO and loop through its items
                    po_doc = frappe.get_doc("Purchase Order", item.purchase_order)
                    receive_qty = 0 
                    pending_qty = 0
                    po_received_qty = 0
                    po_total_qty = po_doc.total_qty
                    for po_item in po_doc.items:
                        po_received_qty = po_item.received_qty + flt(item.qty)
                        # if po_item.name == item.purchase_order_item:  # Match the correct line item
                        if po_item.custom_pending_qty != 0:
                            if receive_qty == 0 :
                                # Over receipt logic
                                received_qty = flt(po_item.qty) - flt(po_item.custom_pending_qty)
                                updated_qty = flt(po_item.custom_pending_qty) + flt(received_qty)
                                pending_update_qty = flt(po_item.qty) - flt(updated_qty)
                                frappe.log_error("Debug Log", f"[IF] Over-receipt: item_code={po_item.item_code}, updated_qty={updated_qty}")
                                frappe.log_error("Debug Log", f"[IF] Over-pending: item_code={po_item.item_code}, updated_qty={pending_update_qty}")
                                frappe.db.set_value("Purchase Order Item", po_item.name, {
                                    "custom_pending_qty": pending_update_qty,
                                    "received_qty": flt(updated_qty)
                                })
                                receive_qty = flt(item.qty) - flt(updated_qty)
                                pending_qty = flt(item.qty) - flt(updated_qty)
                            else:
                                # Normal case
                                received_qty_else = flt(po_item.qty) - flt(po_item.custom_pending_qty)
                                receive_qty_updated_qty = flt(received_qty_else) + flt(receive_qty)
                                receive_qty_update_qty = flt(received_qty_else) + flt(pending_qty)
                                receive_pending_qty = flt(received_qty_else + po_item.custom_pending_qty) - flt(receive_qty_update_qty)
                                frappe.log_error("Debug Log", f"[ELSE] Normal pending: item_code={po_item.item_code}, updated_qty={receive_pending_qty}")
                                frappe.log_error("Debug Log", f"[ELSE] Normal receipt: item_code={po_item.item_code}, updated_qty={receive_qty_updated_qty}")
                                frappe.db.set_value("Purchase Order Item", po_item.name, {
                                    "custom_pending_qty": receive_pending_qty,
                                    "received_qty": receive_qty_updated_qty
                                })
                    # frappe.msgprint(f"{po_received_qty},{po_total_qty}")
                    total_per = (po_received_qty / po_total_qty) * 100 if po_total_qty else 0
                    sum_total_per = po_doc.per_received + total_per
                    frappe.log_error("Debug Log", f"received_percent={sum_total_per}")
                    frappe.db.set_value("Purchase Order", po_doc.name, "per_received",sum_total_per)
                except Exception:
                    frappe.log_error(frappe.get_traceback(), f"Error in po_qty_update for PO Item {item.item_code}")




def update_pending_qty(doc):
    
    doc = frappe.get_doc("Purchase Receipt", doc)  # Fetch latest document
    if doc.merge_item == 0 :
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
    doc = frappe.get_doc("Purchase Receipt", doc)  # Fetch latest document
    if doc.merge_item == 0 :
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


def cancel_po_qty_update(doc, method=None):
    doc = frappe.get_doc("Purchase Receipt", doc) if isinstance(doc, str) else doc
    if doc.merge_item :
        for item in doc.items:
            if item.purchase_order and item.purchase_order_item:
                try:
                    # Get the parent PO and loop through its items
                    po_doc = frappe.get_doc("Purchase Order", item.purchase_order)
                    receive_qty = 0 
                    pending_qty_other = 0
                    po_received_qty = 0
                    po_total_qty = po_doc.total_qty
                    for po_item in po_doc.items:
                        if receive_qty == 0 and po_item.name == item.purchase_order_item:
                             received_qty = flt(po_item.received_qty) 
                             custom_pending_qty = flt(po_item.custom_pending_qty)
                             po_cancel_received = flt(received_qty) - flt(item.qty)
                             po_cancel_pending = flt(custom_pending_qty) + flt(item.qty)
                             frappe.msgprint(f"{po_cancel_received} {po_cancel_pending}")
                             frappe.db.set_value("Purchase Order Item", item.purchase_order_item, {
                                    "custom_pending_qty": po_cancel_pending,
                                    "received_qty": po_cancel_received
                                })
                             po_received_qty = flt(po_item.qty) - flt(received_qty)
                        elif po_item.received_qty !=0 :
                            po_received =  flt(po_item.received_qty)
                            po_pending =  flt(po_item.custom_pending_qty)
                            po_cancel_received_qty = flt(po_received) - flt(po_received_qty)
                            po_cancel_pending_qty = flt(po_pending) + flt(po_received_qty)
                            frappe.msgprint(f"{po_cancel_received_qty} {po_cancel_pending_qty}")
                            frappe.db.set_value("Purchase Order Item", po_item.name, {
                                    "custom_pending_qty": po_cancel_pending_qty,
                                    "received_qty": po_cancel_received_qty
                                })
                                 
                    total_per = (doc.total_qty / po_total_qty) * 100 if po_total_qty else 0
                    sum_total_per = po_doc.per_received - total_per
                    frappe.log_error("Debug Log", f"received_percent={sum_total_per}")
                    frappe.db.set_value("Purchase Order", po_doc.name, "per_received",sum_total_per)                
                except Exception:
                    frappe.log_error(frappe.get_traceback(), f"Error in po_qty_update for PO Item {item.item_code}")
    
import json

import frappe
from frappe import _, msgprint
from frappe.desk.notifications import clear_doctype_notifications
from frappe.model.mapper import get_mapped_doc
from frappe.utils import cint, cstr, flt

from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
	unlink_inter_company_doc,
	update_linked_doc,
	validate_inter_company_party,
)
from erpnext.accounts.doctype.tax_withholding_category.tax_withholding_category import (
	get_party_tax_withholding_details,
)
from erpnext.accounts.party import get_party_account, get_party_account_currency
from erpnext.buying.utils import check_on_hold_or_closed_status, validate_for_items
from erpnext.controllers.buying_controller import BuyingController
from erpnext.manufacturing.doctype.blanket_order.blanket_order import (
	validate_against_blanket_order,
)
from erpnext.setup.doctype.item_group.item_group import get_item_group_defaults
from erpnext.stock.doctype.item.item import get_item_defaults, get_last_purchase_details
from erpnext.stock.stock_balance import get_ordered_qty, update_bin_qty
from erpnext.stock.utils import get_bin
          
@frappe.whitelist()
def make_purchase_receipt(source_name, target_doc=None, args=None):
    def update_item(obj, target, source_parent):
        target.qty = flt(obj.custom_pending_qty) 
        target.stock_qty = target.qty * flt(obj.conversion_factor)
        target.amount = target.qty * flt(obj.rate)
        target.base_amount = target.amount * flt(source_parent.conversion_rate)

    doc = get_mapped_doc(
        "Purchase Order",
        source_name,
        {
            "Purchase Order": {
                "doctype": "Purchase Receipt",
                "field_map": {"supplier_warehouse": "supplier_warehouse"},
                "validation": {"docstatus": ["=", 1]},
            },
            "Purchase Order Item": {
                "doctype": "Purchase Receipt Item",
                "field_map": {
                    "name": "purchase_order_item",
                    "parent": "purchase_order",
                    "bom": "bom",
                    "material_request": "material_request",
                    "material_request_item": "material_request_item",
                    "sales_order": "sales_order",
                    "sales_order_item": "sales_order_item",
                    "wip_composite_asset": "wip_composite_asset"
                },
                "postprocess": update_item,
                "condition": lambda doc: abs(doc.received_qty) < abs(doc.qty)
                    and doc.delivered_by_supplier != 1,
            },
            "Purchase Taxes and Charges": {
                "doctype": "Purchase Taxes and Charges",
                "add_if_empty": True
            },
        },
        target_doc,
        set_missing_values,
    )

    return doc

def set_missing_values(source, target):
    target.run_method("set_missing_values")
    target.run_method("calculate_taxes_and_totals")

