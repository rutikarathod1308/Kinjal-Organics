# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import cint
from pypika.terms import ExistsCriterion
from pypika.functions import Sum, Floor


def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_bom_stock(filters)

    return columns, data

def get_columns():
    """Return columns"""
    columns = [
        {"label": _("Item"), "fieldname": "item", "fieldtype": "Link", "options": "Item", "width": 180},
        {"label": _("Description"), "fieldname": "description", "fieldtype": "Data", "width": 300,"hidden": 1},
        {"label": _("BOM Qty"), "fieldname": "bom_qty", "fieldtype": "Float", "width": 160, "hidden": 1},
        {"label": _("BOM UoM"), "fieldname": "bom_uom", "fieldtype": "Data", "width": 160,"hidden": 1},
        {"label": _("Required Qty"), "fieldname": "required_qty", "fieldtype": "Float", "width": 120},
        {"label": _("In Stock Qty"), "fieldname": "in_stock_qty", "fieldtype": "Float", "width": 120},
        {"label": _("Enough Days to Build"), "fieldname": "enough_days", "fieldtype": "Float", "width": 200},
        {"label": _("Difference Qty"), "fieldname": "difference_qty", "fieldtype": "Float", "width": 120,"hidden": 1},
        {"label": _("Ordered Qty"), "fieldname": "ordered_qty", "fieldtype": "Float", "width": 120},
        {"label": _("Future Days MFG"), "fieldname": "future_days_mfg", "fieldtype": "Float", "width": 140},
        {"label": _("Total Days MFG"), "fieldname": "total_days_mfg", "fieldtype": "Float", "width": 140},
    ]

    return columns


def get_bom_stock(filters):
    qty_to_produce = filters.get("qty_to_produce")
    bom_filter = filters.get("bom")

    if not bom_filter or not qty_to_produce:
        frappe.throw(_("Both BOM and Quantity to Produce are required."))

    # Convert BOM filter to list if comma-separated string
    if isinstance(bom_filter, str):
        bom_filter = [b.strip() for b in bom_filter.split(",")]

    # Convert qty_to_produce to integer if it's a string
    if isinstance(qty_to_produce, str) and "," not in qty_to_produce:
        qty_to_produce = cint(qty_to_produce)  # Single integer value
    elif isinstance(qty_to_produce, str):  # If it's a comma-separated string
        qty_to_produce = [cint(q.strip()) for q in qty_to_produce.split(",")]

    # Case: Multiple BOMs but a single Quantity
    if isinstance(qty_to_produce, int):
        qty_to_produce = [qty_to_produce] * len(bom_filter)  # Apply single qty to all BOMs

    # Dictionary to track aggregated data by item_code
    item_data = {}

    warehouse_details = frappe.db.get_value("Warehouse", filters.get("warehouse"), ["lft", "rgt"], as_dict=1)

    BOM = frappe.qb.DocType("BOM")
    BOM_ITEM = frappe.qb.DocType("BOM Explosion Item" if filters.get("show_exploded_view") else "BOM Item")
    BIN = frappe.qb.DocType("Bin")
    WH = frappe.qb.DocType("Warehouse")

    for bom, qty in zip(bom_filter, qty_to_produce):
        if cint(qty) <= 0:
            frappe.throw(_("Each Quantity to Produce should be greater than zero."))

        if warehouse_details:
            CONDITIONS = ExistsCriterion(
                frappe.qb.from_(WH)
                .select(WH.name)
                .where(
                    (WH.lft >= warehouse_details.lft)
                    & (WH.rgt <= warehouse_details.rgt)
                    & (BIN.warehouse == WH.name)
                )
            )
        else:
            CONDITIONS = BIN.warehouse == filters.get("warehouse")

        QUERY = (
            frappe.qb.from_(BOM)
            .inner_join(BOM_ITEM)
            .on(BOM.name == BOM_ITEM.parent)
            .left_join(BIN)
            .on((BOM_ITEM.item_code == BIN.item_code) & (CONDITIONS))
            .select(
                BOM_ITEM.item_code,
                BOM_ITEM.description,
                BOM_ITEM.stock_qty,
                BOM_ITEM.stock_uom,
                Sum(BOM_ITEM.stock_qty * qty / BOM.quantity).as_("required_qty"),
                BIN.actual_qty.as_("actual_qty"),
                Floor(
                    BIN.actual_qty / (BOM_ITEM.stock_qty * qty / BOM.quantity)
                ).as_("enough_days"),
                (BIN.actual_qty - Sum(BOM_ITEM.stock_qty * qty / BOM.quantity)).as_("difference_qty"),
                BIN.ordered_qty.as_("ordered_qty"),
                Floor(
                    BIN.ordered_qty / Sum(BOM_ITEM.stock_qty * qty / BOM.quantity)
                ).as_("future_days_mfg")
            )
            .where((BOM_ITEM.parent == bom) & (BOM_ITEM.parenttype == "BOM"))
            .groupby(BOM_ITEM.item_code)
        )
        bom_items = QUERY.run(as_dict=True)

        # Aggregate data by item_code
        for item in bom_items:
            item_code = item['item_code']

            # Values coming from the query (per-BOM)
            req_qty = item.get('required_qty') or 0
            actual_qty = item.get('actual_qty') or 0
            ordered_qty = item.get('ordered_qty') or 0

            if item_code in item_data:
                # Sum up required_qty and ordered_qty for existing items
                item_data[item_code]['required_qty'] += req_qty
                # item_data[item_code]['ordered_qty'] += ordered_qty

                # Keep in_stock_qty as the reported actual_qty (should be same across BOMs)
                item_data[item_code]['in_stock_qty'] = actual_qty

                # Recalculate enough_days and future_days_mfg using aggregated totals
                total_required = item_data[item_code]['required_qty']
                total_ordered = item_data[item_code]['ordered_qty']
                total_actual = item_data[item_code]['in_stock_qty']

                if total_required > 0:
                    item_data[item_code]['enough_days'] = total_actual / total_required
                    item_data[item_code]['future_days_mfg'] = (total_ordered / total_required) if total_required else 0
                else:
                    item_data[item_code]['enough_days'] = 0
                    item_data[item_code]['future_days_mfg'] = 0

                # Update difference_qty based on aggregated required_qty
                item_data[item_code]['difference_qty'] = total_actual - total_required

                # Total days is recomputed
                item_data[item_code]['total_days_mfg'] = (
                    item_data[item_code]['enough_days'] + item_data[item_code]['future_days_mfg']
                )

            else:
                # Initialize new item entry using aggregated-required from this query-row
                total_required = req_qty
                total_ordered = ordered_qty
                total_actual = actual_qty

                if total_required > 0:
                    enough_days = total_actual / total_required
                    future_days_mfg = (total_ordered / total_required) if total_required else 0
                else:
                    enough_days = 0
                    future_days_mfg = 0

                item_data[item_code] = {
                    'item': item_code,
                    'description': item.get('description'),
                    'bom_qty': item.get('stock_qty'),
                    'bom_uom': item.get('stock_uom'),
                    'required_qty': total_required,
                    'in_stock_qty': total_actual,
                    'enough_days': enough_days,
                    'difference_qty': (total_actual - total_required),
                    'ordered_qty': total_ordered,
                    'future_days_mfg': future_days_mfg,
                    'total_days_mfg': (enough_days + future_days_mfg)
                }

    # Convert dictionary to list
    result = list(item_data.values())
    return result
