import frappe
from collections import defaultdict

def update_status(doc, method=None):
    sq_qty_map = defaultdict(float)

    # Step 1: Collect current PO's item qty grouped by Supplier Quotation
    for item in doc.items:
        if item.supplier_quotation:
            sq_qty_map[item.supplier_quotation] += item.qty

    for sq in sq_qty_map:
        # Step 2: Find all other PO names (excluding current PO) with the same Supplier Quotation
        po_items = frappe.db.get_all(
            "Purchase Order Item",
            filters={
                "supplier_quotation": sq,
                "parent": ["!=", doc.name]
            },
            fields=["parent"]
        )

        # Step 3: Extract unique parent PO names
        po_names = {item["parent"] for item in po_items}

        # Step 4: Get total_qty from POs that are Submitted and not Cancelled
        other_po_qty = 0
        for po_name in po_names:
            status = frappe.db.get_value("Purchase Order", po_name, "status")
            if status == "To Receive and Bill" or status == "To Bill" or status == "To Receive" or status == "Completed":
                po_doc = frappe.get_doc("Purchase Order", po_name)
                other_po_qty += po_doc.total_qty or 0

        # Step 5: Include current PO's qty
        total_po = other_po_qty + sq_qty_map[sq]

        # Step 6: Fetch Supplier Quotation and compare
        sq_doc = frappe.get_doc("Supplier Quotation", sq)
        total_sq = sq_doc.total_qty or 0

        if total_po >= total_sq:
            frappe.msgprint(f"Updating Supplier Quotation {sq_doc.name} status to Ordered")
            sq_doc.status = "Ordered"
        else:
            frappe.msgprint(f"Updating Supplier Quotation {sq_doc.name} status to Partially Ordered")
            sq_doc.status = "Partially Ordered"
        
        sq_doc.save()



def cancel_update_status(doc, method=None):
    sq_qty_map = defaultdict(float)

    # Collect qty from current (canceled) PO grouped by Supplier Quotation
    for item in doc.items:
        if item.supplier_quotation:
            sq_qty_map[item.supplier_quotation] += item.qty

    for sq in sq_qty_map:
        # Get all remaining PO Items linked to the same Supplier Quotation
        # Exclude: the current PO AND draft/cancelled POs (only consider submitted POs)
        po_items = frappe.db.get_all(
            "Purchase Order Item",
            filters={
                "supplier_quotation": sq
            },
            fields=["parent"]
        )

        # Get only submitted POs (docstatus = 1), and exclude current PO
        other_po_names = {
            item["parent"] for item in po_items
            if item["parent"] != doc.name and frappe.db.get_value("Purchase Order", item["parent"], "docstatus") == 1
        }

        # Calculate total ordered qty from submitted POs
        other_po_qty = 0
        for po_name in other_po_names:
            other_po = frappe.get_doc("Purchase Order", po_name)
            other_po_qty += other_po.total_qty or 0

        # Get Supplier Quotation total
        sq_doc = frappe.get_doc("Supplier Quotation", sq)
        total_sq = sq_doc.total_qty or 0

        # Compare and update status
        if other_po_qty >= total_sq:
            sq_doc.status = "Ordered"
            frappe.msgprint(f"After cancel, Supplier Quotation {sq_doc.name} status updated to: Ordered")
        elif other_po_qty > 0:
            sq_doc.status = "Partially Ordered"
            frappe.msgprint(f"After cancel, Supplier Quotation {sq_doc.name} status updated to: Partially Ordered")
        else:
            sq_doc.status = "Submitted"  # Or "Open" if you have such status
            frappe.msgprint(f"After cancel, Supplier Quotation {sq_doc.name} status updated to: Submitted")

        # Save changes
        sq_doc.save()

