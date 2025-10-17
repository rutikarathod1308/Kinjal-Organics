import frappe

@frappe.whitelist()
def delivery_value(delivery_note):
    # Fetch delivery note data where 'return_against' matches given delivery_note
    delivery_data = frappe.get_all(
        "Delivery Note",
        filters={"return_against": delivery_note},
        fields=["name", "customer", "posting_date", "status"]
    )

    
    return delivery_data

   
