import frappe
from frappe import _
from frappe.utils import get_link_to_form

@frappe.whitelist()
def raise_production_plan(material_request):
    mr = frappe.get_doc("Material Request", material_request)
    errors = []
    production_plan = []

    for d in mr.items:
        if (d.stock_qty - d.ordered_qty) > 0:
            bom_no = frappe.db.get_value("BOM", {"item": d.item_code, "is_default": 1}, "name")
            if not bom_no:
                errors.append(
                    _("Row {0}: BOM not found for Item {1}").format(
                        d.idx, get_link_to_form("Item", d.item_code)
                    )
                )
                continue  # Skip this item if BOM is missing
            
            warehouse = d.warehouse or frappe.db.get_single_value("Stock Settings", "default_warehouse")
            stock_uom = d.stock_uom or "Nos"  # Provide a default UOM if missing

            pplan = frappe.new_doc("Production Plan")
            pplan.update({
                "get_items_from": "Material Request",
                "material_requests": []
            })

            # ✅ Add Material Request reference
            if mr.name and mr.transaction_date:
                pplan.append("material_requests", {
                    "material_request": mr.name,
                    "material_request_date": mr.transaction_date
                })

            # ✅ Add items in `planned_orders`
            pplan.append("material_requests", {
                "item_code": d.item_code,
                "bom_no": bom_no,
                "planned_qty": d.qty,
                "stock_uom": stock_uom,
                "warehouse": warehouse
            })

            # ✅ Remove empty rows from `material_requests`
            pplan.material_requests = [row for row in pplan.material_requests if row.material_request]

            pplan.flags.ignore_mandatory = True
            pplan.save()
            production_plan.append(pplan.name)

    # ✅ Show success message with clickable links
    if production_plan:
        production_plan_links = [get_link_to_form("Production Plan", pp) for pp in production_plan]
        frappe.msgprint(
            _("Production Plan(s) Created Successfully:<br>{0}").format("<br>".join(production_plan_links))
        )

    # ✅ Show errors if any BOMs are missing
    if errors:
        frappe.throw("<br>".join(errors))

    return production_plan
