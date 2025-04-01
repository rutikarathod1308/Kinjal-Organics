import frappe
from kinjal.overrides.whitelisted.purchase_order import update_child_qty_rate as original_update_child_qty_rate

@frappe.whitelist()
def customupdate_child_qty_rate(*args, **kwargs):
    frappe.msgprint("Running from kinjal_organics")
    frappe.log_error("Debug Log", "Hello, it's Kinjal Organics file code working!")
    # Add your custom logic here...
    return original_update_child_qty_rate(*args, **kwargs)  # Call original if needed
