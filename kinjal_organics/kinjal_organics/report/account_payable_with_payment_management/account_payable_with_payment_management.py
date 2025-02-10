# Copyright (c) 2025, Sanskar Technolab Private Limited and contributors
# For license information, please see license.txt

from erpnext.accounts.report.accounts_receivable.accounts_receivable import ReceivablePayableReport
import frappe

def execute(filters=None):
	args = {
		"account_type": "Payable",
		"naming_by": ["Buying Settings", "supp_master_name"],
	}
	return ReceivablePayableReport(filters).run(args)
