// Copyright (c) 2025, Sanskar Technolab Private Limited and contributors
// For license information, please see license.txt
/* eslint-disable */

frappe.query_reports["Stock Projected Qty Report"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
			get_query: () => {
				return {
					filters: {
						company: frappe.query_report.get_filter_value("company"),
					},
				};
			},
		},
		{
			fieldname: "item_code",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
			get_query: function () {
				return {
					query: "erpnext.controllers.queries.item_query",
				};
			},
		},
		{
			fieldname: "item_group",
			label: __("Item Group"),
			fieldtype: "Link",
			options: "Item Group",
		},
		{
			fieldname: "brand",
			label: __("Brand"),
			fieldtype: "Link",
			options: "Brand",
		},
		{
			fieldname: "include_uom",
			label: __("Include UOM"),
			fieldtype: "Link",
			options: "UOM",
		},
	],

	onload: function (report) {
		// Ensure button is only added once
		if (!report.custom_button_added) {
			report.custom_button_added = true;
	
			report.page.add_inner_button(__('Generate & Submit Material Requests'), function () {
				let filters = report.get_values();
	
				// Fetch the report data
				frappe.call({
					method: "frappe.desk.query_report.run",
					args: {
						report_name: "Stock Projected Qty Report",
						filters: filters
					},
					callback: function (response) {
						if (response.message && response.message.result.length > 0) {
							let report_data = response.message.result;
	
							// Filter and prepare data
							let items = report_data
								.map(row => ({
									item_code: row.item_code,
									warehouse: row.warehouse,
									description: row.description,
									uom: row.uom,
									stock_uom: row.stock_uom,
									required_by: frappe.datetime.nowdate(),
									re_order_qty: Math.max(0, row.re_order_qty),
									re_order_level: Math.max(0, row.re_order_level),
									actual_qty: Math.max(0, row.actual_qty),
									qty: Math.max(0, row.re_order_qty), // Ensure positive quantity
									indented_qty: row.indented_qty
								}))
								.filter(item => item.indented_qty < item.re_order_qty && item.re_order_level > item.actual_qty);
	
							if (items.length === 0) {
								frappe.msgprint(__('No items with re-order quantity greater than indented quantity available for Material Request.'));
								return;
							}
	
							// Create separate Material Requests for each item
							items.forEach(item => {
								frappe.call({
									method: "frappe.client.insert",
									args: {
										doc: {
											doctype: "Material Request",
											material_request_type: "Purchase",
											schedule_date: frappe.datetime.nowdate(),
											company: filters.company,
											items: [item] // Single item per Material Request
										}
									},
									callback: function (res) {
										if (res.message) {
											let material_request_name = res.message.name;
	
											// Submit the Material Request
											frappe.call({
												method: "frappe.client.submit",
												args: {
													doc: res.message
												},
												callback: function () {
													frappe.msgprint({
														title: __('Success'),
														message: __('Material Request {0} has been submitted successfully.', [material_request_name]),
														indicator: 'green'
													});
	
													// Uncomment this if you want to redirect to the new Material Request form
													// frappe.set_route("Form", "Material Request", material_request_name);
												}
											});
										}
									}
								});
							});
	
						} else {
							frappe.msgprint(__('No data available for the selected filters.'));
						}
					}
				});
			});
		}
	}
	
	
};
