import frappe

@frappe.whitelist()
def get_supplier_address(supplier):
    address = frappe.db.sql("""
        SELECT parent 
        FROM `tabDynamic Link`
        WHERE link_doctype='Supplier' AND link_name=%s AND parenttype='Address'
        LIMIT 1
    """, supplier, as_dict=True)

    if address:
        address_name = address[0]["parent"]
        address_details = frappe.db.get_value("Address", address_name, "email_id")
        return address_details
    return None
