from erpnext.setup.utils import get_exchange_rate
import frappe
from collections import defaultdict
from erpnext.accounts.doctype.payment_request.payment_request import (
    get_existing_payment_request_amount,
    get_amount,
)
from frappe.utils.data import flt
from frappe.utils import nowdate
import traceback



@frappe.whitelist()
def create_payment_request(selected_rows, company):
    response = {"error": [], "success": []}
    selected_rows = frappe.parse_json(selected_rows)
    grouped_by_supplier = defaultdict(list)

    for row in selected_rows:
        grouped_by_supplier[row.get("party")].append(row)

    company_doc = frappe.get_doc("Company", company)
    default_bank_account = company_doc.default_bank_account

    for party, rows in grouped_by_supplier.items():
        for row in rows:
            if (
                row.get("voucher_type") is None
                or row.get("voucher_no") is None
                or row.get("voucher_type") == "Journal Entry"
            ):
                continue

            ref_doc = frappe.get_doc(row.get("voucher_type"), row.get("voucher_no"))

            # Fetch supplier's bank account
            supplier_bank_account = frappe.get_value(
                "Bank Account", {"party": party, "party_type": "Supplier"}, "name"
            )
            payment_type = frappe.get_value(
                "Payment Type", {"company": company, "is_default": 1}, "name"
            )

            # If no supplier bank account, use company’s default
            bank_account = supplier_bank_account or default_bank_account

            # Fetch currency from supplier or use company's default
            supplier_currency = ref_doc.get("currency") or company_doc.default_currency

            payment_request = frappe.get_doc(
                {
                    "doctype": "Bank Payment Request",
                    "party": party,
                    "party_type": row.get("party_type"),
                    "payment_request_type": "Outward",
                    "reference_doctype": row.get("voucher_type"),
                    "reference_name": row.get("voucher_no"),
                    "net_total": row.get("outstanding"),
                    "transaction_date": nowdate(),
                    "mode_of_payment": "Wire Transfer",
                    "bank_account": bank_account,
                    "party_account_currency": supplier_currency,
                    "payment_type" : payment_type
                }
            )

            payment_request.save()
            payment_request.submit()
            response["success"].append(
                f"""<p>Bank Payment Request for <a href="/app/supplier/{party}">{party}</a> - 
                <a href="{ref_doc.get_url()}">{row.get('voucher_no')}</a> - 
                <a href="{payment_request.get_url()}">{payment_request.get('name')}</a> 
                has been created successfully.</p>
                """
            )

    return response

