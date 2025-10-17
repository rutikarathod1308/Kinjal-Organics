import frappe
from frappe import _
import time
from frappe.utils import flt
import json
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

def update_purchase_receipt(doc=None, method=None):
    frappe.enqueue(po_qty_update_example, queue="long", doc=doc.name)
    validate_po_state_on_submit(doc, method)
def cancel_purchase_receipt(doc=None,method=None):
    frappe.enqueue(po_qty_cancel_example, queue="long", doc=doc.name)
    # frappe.enqueue(cancel_po_qty_update, queue="long", doc=doc.name)



def po_qty_cancel_example(doc, method=None):
    """Reverse Purchase Order quantities when a merged Purchase Receipt is cancelled."""
    time.sleep(1)

    # Ensure doc is a Purchase Receipt document
    if isinstance(doc, str):
        doc = frappe.get_doc("Purchase Receipt", doc)
    elif isinstance(doc, dict):
        doc = frappe.get_doc("Purchase Receipt", doc.get("name"))

    # Only run if merge_item == 1
    

    processed_orders = set()

    for item in doc.items:
        po_name = getattr(item, "purchase_order", None)
        if not po_name or po_name in processed_orders:
            continue

        try:
            po_doc = frappe.get_doc("Purchase Order", po_name)
            # frappe.log_error("PO Cancel Debug", f"Processing PO Cancel: {po_doc.name}")

            # Group PR items belonging to the same PO
            related_pr_items = [i for i in doc.items if i.purchase_order == po_name]
            merged_data = {}

            for pr_item in related_pr_items:
                key = (pr_item.item_code, pr_item.uom, pr_item.rate)
                if key not in merged_data:
                    merged_data[key] = {"total_qty": 0, "items": []}
                merged_data[key]["total_qty"] += flt(pr_item.qty)
                merged_data[key]["items"].append(pr_item)

            po_doc.flags.ignore_validate_update_after_submit = True
            po_doc.flags.ignore_permissions = True
            po_doc.flags.ignore_mandatory = True

            # Loop through merged data
            for (item_code, uom, rate), data in merged_data.items():
                cancel_qty = data["total_qty"]
                remaining_qty = cancel_qty

                # For cancel, we want to reverse the most recently received quantities first
                po_items = [
                    po_item for po_item in po_doc.items
                    if po_item.item_code == item_code and po_item.receipt_received_qty > 0
                ]
                po_items.sort(key=lambda x: x.idx, reverse=True)

                for po_item in po_items:
                    current_received = flt(po_item.receipt_received_qty)
                    if current_received <= 0:
                        continue

                    reverse_qty = min(current_received, remaining_qty)
                    new_received = current_received - reverse_qty
                    new_pending = flt(po_item.qty) - new_received

                    # Prevent negative values
                    new_received = max(new_received, 0)
                    new_pending = max(new_pending, 0)

                    frappe.db.set_value(
                        "Purchase Order Item",
                        po_item.name,
                        {
                            "received_qty": new_received,
                            "receipt_received_qty": new_received,
                            "custom_pending_qty": new_pending if hasattr(po_item, "custom_pending_qty") else None
                        }
                    )
                    frappe.log_error("Cancel Qty",f"{new_received},{new_pending}")
                    remaining_qty -= reverse_qty
                    if remaining_qty <= 0:
                        break

                if remaining_qty > 0:
                    frappe.log_error("Unreversed Qty", f"{item_code}: {remaining_qty} qty could not be reversed")

            # --- Update PO per_received percentage ---
            total_received = sum(flt(i.receipt_received_qty ) for i in po_doc.items)
            full_total_received = total_received 
            total_ordered = sum(flt(i.qty) for i in doc.items)
            per_received = (total_ordered / full_total_received * 100) if total_ordered else 0
            full_per_received = 100 - per_received

            # frappe.db.set_value("Purchase Order", po_doc.name, "per_received", per_received)
            frappe.db.commit()

            frappe.log_error("PO Cancel Success", f"PO {po_doc.name} reversed successfully. Per Received: {full_per_received}% ")

            processed_orders.add(po_name)

        except Exception:
            frappe.log_error("PO Cancel Error", f"{po_name}: {frappe.get_traceback()}")



def po_qty_update_example(doc, method=None):
    """Update Purchase Order quantities after a merged Purchase Receipt is submitted."""
    time.sleep(1)

    # Ensure doc is a Purchase Receipt document
    if isinstance(doc, str):
        doc = frappe.get_doc("Purchase Receipt", doc)
    elif isinstance(doc, dict):
        doc = frappe.get_doc("Purchase Receipt", doc.get("name"))

    # Only run if merge_item == 1
    

    processed_orders = set()

    for item in doc.items:
        po_name = getattr(item, "purchase_order", None)
        if not po_name or po_name in processed_orders:
            continue

        try:
            po_doc = frappe.get_doc("Purchase Order", po_name)
            frappe.log_error("Merge Debug", f"Processing PO: {po_doc.name}")
            po_total_received_qty = 0
            for poitem in po_doc.items :
                po_total_received_qty += poitem.receipt_received_qty
            po_received_qty = po_total_received_qty + doc.total_qty
            if po_received_qty <= po_doc.total_qty :
                # frappe.throw("Its worked")
                # Group PR items belonging to the same PO
                related_pr_items = [i for i in doc.items if i.purchase_order == po_name]
                merged_data = {}

                for pr_item in related_pr_items:
                    key = (pr_item.item_code, pr_item.uom, pr_item.rate)
                    if key not in merged_data:
                        merged_data[key] = {"total_qty": 0, "items": []}
                    merged_data[key]["total_qty"] += flt(pr_item.qty)
                    merged_data[key]["items"].append(pr_item)

                po_doc.flags.ignore_validate_update_after_submit = True
                po_doc.flags.ignore_permissions = True
                po_doc.flags.ignore_mandatory = True
                
                # Loop through merged data
                for (item_code, uom, rate), data in merged_data.items():
                    
                    total_qty = data["total_qty"]
                    remaining_qty = total_qty
                    
                    po_items = [
                        po_item for po_item in po_doc.items
                        if po_item.item_code == item_code and po_item.qty > po_item.receipt_received_qty
                    ]

                    po_items.sort(key=lambda x: x.idx)

                    for po_item in po_items:
                        pending_qty = flt(po_item.qty) - flt(po_item.receipt_received_qty)
                        if pending_qty <= 0:
                            continue

                        allocate_qty = min(pending_qty, remaining_qty)
                        new_received = flt(po_item.receipt_received_qty) + allocate_qty
                        new_pending = flt(po_item.qty) - new_received

                        # Update each PO Item directly in DB
                        frappe.db.set_value(
                            "Purchase Order Item",
                            po_item.name,
                            {
                                "received_qty": new_received,
                                "receipt_received_qty":new_received,
                                "custom_pending_qty": new_pending if hasattr(po_item, "custom_pending_qty") else None
                            }
                        )

                        remaining_qty -= allocate_qty
                        if remaining_qty <= 0:
                            break

                    if remaining_qty > 0:
                        frappe.log_error("Unallocated Qty", f"{item_code}: {remaining_qty} qty not allocated")

                # --- Update PO per_received percentage ---
                total_received = sum(flt(i.receipt_received_qty ) for i in po_doc.items)
            
                full_total_received = total_received + doc.total_qty
                total_ordered = sum(flt(i.qty) for i in po_doc.items)
                per_received = (full_total_received / total_ordered * 100) if total_ordered else 0

                frappe.db.set_value("Purchase Order", po_doc.name, "per_received", per_received)
                frappe.log_error("Per Received Success", f"PO {per_received} updated successfully")
                frappe.db.commit()
                frappe.log_error("PO Merge Success", f"PO {po_doc.name} updated successfully")

                processed_orders.add(po_name)

        except Exception:
            frappe.log_error("PO Merge Error", f"{po_name}: {frappe.get_traceback()}")




          
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



def validate_po_state_on_submit(doc, method=None):
    """
    Prevent submitting a Purchase Receipt if any linked Purchase Order
    is in 'Re-Approve' state.
    """
    for item in doc.items:
        if item.purchase_order:
            po = frappe.get_doc("Purchase Order", item.purchase_order)
            if po.workflow_state == "Re-Approve":
                frappe.throw(
                    _("Linked Purchase Order {0} is in 'Re-Approve'. Please approve the Purchase Order before submitting.")
                    .format(item.purchase_order)
                )
            po_qty = 0
            for po_item in po.items :
                po_qty += po_item.receipt_received_qty
            if po_qty + doc.total_qty > po.total_qty :
                # frappe.throw("overlimit")
                reduce_by = (po_qty + doc.total_qty) - po.total_qty
                # frappe.throw(f"{reduce_by}")
                frappe.throw(
                _(
                    "This document is over limit by {0}. Are you making another {1} against the same {2}?"
                ).format(
                    frappe.bold(reduce_by),
                    frappe.bold("Purchase Order"),
                    frappe.bold("Purchase Receipt")
                )
                + "<br><br>",
                title=_("Limit Crossed"),
                )   

