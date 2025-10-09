app_name = "kinjal_organics"
app_title = "Kinjal Organics"
app_publisher = "Sanskar Technolab Private Limited"
app_description = "Kinjal Organics"
app_email = "sanskartechnolab@gmail.com"
app_license = "MIT"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/kinjal_organics/css/kinjal_organics.css"
# app_include_js = "/assets/kinjal_organics/js/kinjal_organics.js"

# include js, css files in header of web template
# web_include_css = "/assets/kinjal_organics/css/kinjal_organics.css"
# web_include_js = "/assets/kinjal_organics/js/kinjal_organics.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "kinjal_organics/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}
from erpnext.controllers import status_updater
from kinjal_organics.public.py.oveeride_status_updater import custom_StatusUpdater

status_updater.StatusUpdater.limits_crossed_error = custom_StatusUpdater.limits_crossed_error
# include js in doctype views
doctype_js = {
    "Request for Quotation" : "public/js/request_for_quotation.js",
    "Material Request" : "public/js/material_request.js",
    "Item" : "public/js/item.js",
    "Sales Order" : "public/js/sales_order.js",
    "Purchase Order" : "public/js/purchase_order.js",
    "Payment Entry" : "public/js/payment_entry.js",
    "Purchase Invoice" : "public/js/purchase_invoice.js",
    "Purchase Receipt" : "public/js/purchase_receipt.js",
    "Sales Invoice" : "public/js/sales_invoice.js",
    "Delivery Note" : "public/js/delivery_note.js",
    "BOM":"public/js/bom.js"
    }
doctype_list_js = {"Material Request" : "public/js/material_request_list.js",
                   "Request for Quotation" : "public/js/request_for_quotation_list.js",
                   "Supplier Quotation" : "public/js/supplier_quotation_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "kinjal_organics.utils.jinja_methods",
# 	"filters": "kinjal_organics.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "kinjal_organics.install.before_install"
# after_install = "kinjal_organics.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "kinjal_organics.uninstall.before_uninstall"
# after_uninstall = "kinjal_organics.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "kinjal_organics.utils.before_app_install"
# after_app_install = "kinjal_organics.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "kinjal_organics.utils.before_app_uninstall"
# after_app_uninstall = "kinjal_organics.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "kinjal_organics.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"Production Plan": "kinjal_organics.public.py.production_plan.CustomToDo"
# }
override_doctype_class = {
   "Production Plan": "kinjal_organics.public.py.production_plan.custom_ProductionPlan_over"
}
# Document Events
# ---------------
# Hook on document methods and events
doc_events = {
    "Purchase Receipt":{
        # "on_submit":"kinjal_organics.public.py.purchase_receipt.update_purchase_receipt",
        "on_submit":"kinjal_organics.public.py.purchase_receipt.update_purchase_receipt",
        "on_cancel":"kinjal_organics.public.py.purchase_receipt.cancel_purchase_receipt"
    },
    
    "Purchase Invoice":{
        "on_submit":"kinjal_organics.public.py.purchase_invoice.update_purchase_invoice",
        "on_cancel":"kinjal_organics.public.py.purchase_invoice.cancel_purchase_invoice",
        "after_insert" :"kinjal_organics.public.py.purchase_invoice.generate_journal_entry",
    },
    "Purchase Order":{
        "on_submit":"kinjal_organics.public.py.purchase_order_supplier_status.update_status",
        "on_cancel":"kinjal_organics.public.py.purchase_order_supplier_status.cancel_update_status",
    },
   
    "Delivery Note":{
        "on_submit":"kinjal_organics.public.py.delivery_note.update_delivery_note",
        "on_cancel":"kinjal_organics.public.py.delivery_note.cancel_delivery_note"
    },
    "Request for Quotation":{
        "on_submit":"kinjal_organics.public.py.rfq.update_status"
    },
    "Supplier Quotation":{
        "on_submit":"kinjal_organics.public.py.supplier_quotation.update_status",
        "on_cancel":"kinjal_organics.public.py.supplier_quotation.cancel_update_status",
    },
#    Payment Entry":{
#         "onload":"kinjal_organics.public.py.payment_entry.onload_payment_entry"
#     } "
}
# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"kinjal_organics.tasks.all"
# 	],
# 	"daily": [
# 		"kinjal_organics.tasks.daily"
# 	],
# 	"hourly": [
# 		"kinjal_organics.tasks.hourly"
# 	],
# 	"weekly": [
# 		"kinjal_organics.tasks.weekly"
# 	],
# 	"monthly": [
# 		"kinjal_organics.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "kinjal_organics.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
#     "erpnext.manufacturing.doctype.production_plan.production_plan.get_sub_assembly_items": 
#     "kinjal_organics.overrides.production_plan.get_sub_assembly_items"
# }
# kinjal_organics/hooks.py


# from kinjal.kinjal.overrides.whitelisted.purchase_order import update_child_qty_rate
# from kinjal_organics.public.py.purchase_controller import update_child_qty_rate

# update_child_qty_rate = update_child_qty_rate
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "kinjal_organics.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["kinjal_organics.utils.before_request"]
# after_request = ["kinjal_organics.utils.after_request"]

# Job Events
# ----------
# before_job = ["kinjal_organics.utils.before_job"]
# after_job = ["kinjal_organics.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"kinjal_organics.auth.validate"
# ]

fixtures = [
    "Workflow State",
     {"dt":"Custom Field","filters":[
        [
            "module","in",[
               "Kinjal Organics"
            ],
        ]
    ]},
     {"dt":"Report","filters":[
        [
        "module","in",[
                "Kinjal Organics"
            ]
        ]
    ]},
       {"dt":"Email Template","filters":[
        [
        "name","in",[
                "Request for Quotation"
            ]
        ]
    ]},
        {"dt":"Workflow","filters":[
        [
        "name","in",[
                "Sales Order"
            ]
        ]
    ]},
        {
            "dt":"Property Setter","filters":[
             [
            "module","in",[
               "Kinjal Organics"
            ],
        ]
            ]
        }
     
]

