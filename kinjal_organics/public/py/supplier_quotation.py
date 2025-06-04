import frappe

def update_status(doc, method=None):
    frappe.logger().info("Triggered RFQ on_submit hook.")
    
    updated_requests = set()
    updated_rfq = set()
    for item in doc.items:
        mr = item.material_request
        rfq = item.request_for_quotation
        frappe.logger().info(f"Item: {item.item_code}, Linked MR: {mr}")
        
        if mr and mr not in updated_requests:
            try:
                frappe.db.set_value("Material Request", mr, "status", "Quotated")
                updated_requests.add(mr)
                frappe.logger().info(f"Updated MR {mr} status to RFQ.")
            except Exception as e:
                frappe.logger().error(f"Failed to update MR {mr}: {e}")
        if rfq and rfq not in updated_rfq:
            try:
                # Get all suppliers linked to this RFQ
                rfq_doc = frappe.get_doc("Request for Quotation", rfq)
                total_suppliers = len(rfq_doc.suppliers)
               
                # Count how many quotations are submitted for this RFQ
                submitted_quotations = frappe.db.count(
                    "Request for Quotation Supplier",
                    filters={
                        "parent": rfq,
                        "quote_status": "Received"  # Submitted status
                    }
                )
                
                # Decide status based on number of received quotations
                total_received_quotation = submitted_quotations 
                
                if total_received_quotation == total_suppliers:
                    frappe.db.set_value("Request for Quotation", rfq, "status", "Received")
                else :
                    frappe.db.set_value("Request for Quotation", rfq, "status", "Partially Received")

                frappe.db.set_value("Request for Quotation", rfq, "status", status)

            except Exception as e:
                frappe.logger().error(f"Failed to update RFQ {rfq}: {e}")


        
        
def cancel_update_status(doc, method=None):
    frappe.logger().info("Triggered RFQ on_submit hook.")
    
    updated_requests = set()
    updated_rfq = set()
    for item in doc.items:
        mr = item.material_request
        rfq = item.request_for_quotation
        frappe.logger().info(f"Item: {item.item_code}, Linked MR: {mr}")
        
        if mr and mr not in updated_requests:
            try:
                frappe.db.set_value("Material Request", mr, "status", "Quotated")
                updated_requests.add(mr)
                frappe.logger().info(f"Updated MR {mr} status to RFQ.")
            except Exception as e:
                frappe.logger().error(f"Failed to update MR {mr}: {e}")
        if rfq and rfq not in updated_rfq:
            try:
                # Get all suppliers linked to this RFQ
                rfq_doc = frappe.get_doc("Request for Quotation", rfq)
                total_suppliers = len(rfq_doc.suppliers)
               
                # Count how many quotations are submitted for this RFQ
                submitted_quotations = frappe.db.count(
                    "Request for Quotation Supplier",
                    filters={
                        "parent": rfq,
                        "quote_status": "Pending"  # Submitted status
                    }
                )
                
                # Decide status based on number of received quotations
                total_received_quotation = submitted_quotations 
                
                if total_received_quotation == total_suppliers:
                    frappe.db.set_value("Request for Quotation", rfq, "status", "Submitted")
                else :
                    frappe.db.set_value("Request for Quotation", rfq, "status", "Partially Received")

      

            except Exception as e:
                frappe.logger().error(f"Failed to update RFQ {rfq}: {e}")


        