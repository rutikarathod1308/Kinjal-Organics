import frappe

def update_status(doc, method=None):
    frappe.logger().info("Triggered RFQ on_submit hook.")
    
    updated_requests = set()

    for item in doc.items:
        mr = item.material_request
        frappe.logger().info(f"Item: {item.item_code}, Linked MR: {mr}")
        
        if mr and mr not in updated_requests:
            try:
                frappe.db.set_value("Material Request", mr, "status", "RFQ")
                updated_requests.add(mr)
                frappe.logger().info(f"Updated MR {mr} status to RFQ.")
            except Exception as e:
                frappe.logger().error(f"Failed to update MR {mr}: {e}")
