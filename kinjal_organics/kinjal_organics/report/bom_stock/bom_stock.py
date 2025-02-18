# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.query_builder.functions import Floor, Sum
from frappe.utils import cint
from pypika.terms import ExistsCriterion


def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_bom_stock(filters)

    return columns, data


def get_columns():
    """return columns"""
    columns = [
        _("Item") + ":Link/Item:150",
        _("Description") + "::300",
        _("BOM Qty") + ":Float:160",
        _("BOM UoM") + "::160",
        _("Required Qty") + ":Float:120",
        _("In Stock Qty") + ":Float:120",
        _("Enough Parts to Build") + ":Float:200",
        _("Difference Qty") + ":Float:120",
        _("Ordered Qty") + ":Float:120",
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

    # Ensure both lists have the same length
    # if len(bom_filter) != len(qty_to_produce):
    #     frappe.throw(_("Mismatch: BOMs and Quantities must have the same count."))

    results = []
    warehouse_details = frappe.db.get_value("Warehouse", filters.get("warehouse"), ["lft", "rgt"], as_dict=1)

    BOM = frappe.qb.DocType("BOM")
    BOM_ITEM = frappe.qb.DocType("BOM Explosion Item" if filters.get("show_exploded_view") else "BOM Item")
    BIN = frappe.qb.DocType("Bin")
    WH = frappe.qb.DocType("Warehouse")

    for bom, qty in zip(bom_filter, qty_to_produce):
        if cint(qty) <= 0:
            frappe.throw(_("Each Quantity to Produce should be greater than zero."))

        CONDITIONS = ()
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
                Sum(BOM_ITEM.stock_qty).as_("stock_qty"),
                BOM_ITEM.stock_uom,
                Sum(BOM_ITEM.stock_qty * qty / BOM.quantity).as_("required_qty"),
                BIN.actual_qty.as_("actual_qty"),
                Floor(BIN.actual_qty / (BOM_ITEM.stock_qty * qty / BOM.quantity)),
                BIN.actual_qty - (Sum(BOM_ITEM.stock_qty * qty / BOM.quantity)).as_("difference_qty"),
                BIN.ordered_qty.as_("ordered_qty"),
            )
            .where((BOM_ITEM.parent == bom) & (BOM_ITEM.parenttype == "BOM"))
            .groupby(BOM_ITEM.item_code)
        )

        results.extend(QUERY.run())

    return results
