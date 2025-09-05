import frappe 

def quotation_status_update(doc,method=None):
    supplier_value = frappe.get_doc("Supplier Quotation")