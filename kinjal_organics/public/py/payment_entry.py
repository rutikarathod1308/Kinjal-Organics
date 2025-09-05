import frappe

@frappe.whitelist()
def get_payment_permission_role():
    roles = frappe.get_roles(frappe.session.user)
    if "Payment Pay" in roles:
        return "Pay"
    elif "Payment Receive" in roles:
        return "Receive"
    else:
        return "None"
    
    
@frappe.whitelist()
def get_customer_payment_permission(customer):
    return frappe.db.get_value("Customer", customer, "advance_payment", cache=True) or "None"

@frappe.whitelist()
def get_supplier_payment_permission(supplier):
    return frappe.db.get_value("Supplier", supplier, "allow_advance_payment") or "None"
    
