import frappe

@frappe.whitelist()
def get_selected_enabled_roles():
    """Return either Pay / Receive / None based on the user's active roles."""
    
    # Fetch all roles assigned to the current user
    assigned_roles = frappe.get_all(
        "Has Role",
        filters={"parent": frappe.session.user, "parenttype": "User"},
        pluck="role"
    )

    # Fetch all enabled roles
    enabled_roles = frappe.get_all(
        "Role",
        filters={"disabled": 0},
        pluck="name"
    )

    # Keep only roles that are both assigned AND enabled
    active_roles = [role for role in assigned_roles if role in enabled_roles]

    # Now check which permission applies
    if "Payment Pay" in active_roles:
        return "Pay"
    elif "Payment Receive" in active_roles:
        return "Receive"
    else:
        return "None"

    
    
@frappe.whitelist()
def get_customer_payment_permission(customer):
    return frappe.db.get_value("Customer", customer, "advance_payment") or "None"



@frappe.whitelist()
def get_supplier_payment_permission(supplier):
    # Fetch multiple fields
    supplier_data = frappe.db.get_value(
        "Supplier",
        supplier,
        ["allow_advance_payment", "advance_limit"],  # list of fields
        as_dict=True  # return as dictionary
    )
    
    # Return data (or default if not found)
    if not supplier_data:
        supplier_data = {"allow_advance_payment": "None", "advance_limit": 0}
    
    return supplier_data


    




@frappe.whitelist()
def get_selected_fifo_roles():
    """Return either Fifo / None based on the user's active roles."""
    
    # Fetch all roles assigned to the current user
    assigned_roles = frappe.get_all(
        "Has Role",
        filters={"parent": frappe.session.user, "parenttype": "User"},
        pluck="role"
    )

    # Fetch all enabled roles
    enabled_roles = frappe.get_all(
        "Role",
        filters={"disabled": 0},
        pluck="name"
    )

    # Keep only roles that are both assigned AND enabled
    active_roles = [role for role in assigned_roles if role in enabled_roles]

    # Now check which permission applies
    if "FIFO Advance" in active_roles:
        return "FIFO"
    else:
        return "None"