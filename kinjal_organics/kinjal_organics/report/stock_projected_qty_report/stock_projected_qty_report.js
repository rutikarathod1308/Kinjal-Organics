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
			
				frappe.call({
					method: "frappe.desk.query_report.run",
					args: {
						report_name: "Stock Projected Qty Report",
						filters: filters
					},
					callback: function (response) {
						if (response.message && response.message.result.length > 0) {
							let report_data = response.message.result;
							let reorder_name = response.message.message;
				
							let grouped_items = {};
				
							// Group items by item_code and material_request_type
							report_data.forEach(row => {
								if (row.indented_qty < row.re_order_qty && row.re_order_level > row.actual_qty) {
									let material_type = "";
				
									if (reorder_name[row.item_code]) {
										for (let i = 0; i < reorder_name[row.item_code].reorder_levels.length; i++) {
											let reorder_level = reorder_name[row.item_code].reorder_levels[i];
				
											if (row.item_code === reorder_level.parent && row.warehouse === reorder_level.warehouse) {
												material_type = reorder_level.material_request_type === "Transfer" 
													? "Material Transfer" 
													: reorder_level.material_request_type;
												break;
											}
										}
									}
				
									let key = `${row.item_code}__${material_type}`; // Unique key for grouping
				
									if (!grouped_items[key]) {
										grouped_items[key] = {
											material_request_type: material_type,
											items: []
										};
									}
				
									grouped_items[key].items.push({
										item_code: row.item_code,
										warehouse: row.warehouse,
										description: row.description,
										uom: row.uom,
										stock_uom: row.stock_uom,
										required_by: frappe.datetime.nowdate(),
										re_order_qty: Math.max(0, row.re_order_qty),
										re_order_level: Math.max(0, row.re_order_level),
										actual_qty: Math.max(0, row.actual_qty),
										qty: Math.max(0, row.re_order_qty),
										indented_qty: row.indented_qty
									});
								}
							});
				
							if (Object.keys(grouped_items).length === 0) {
								frappe.msgprint(__('No items with re-order quantity greater than indented quantity available for Material Request.'));
								return;
							}
				
							// Process each unique (item_code + material_request_type) group
							Object.keys(grouped_items).forEach(key => {
								let group = grouped_items[key];
				
								frappe.call({
									method: "frappe.client.insert",
									args: {
										doc: {
											doctype: "Material Request",
											schedule_date: frappe.datetime.nowdate(),
											company: filters.company,
											items: group.items,
											material_request_type: group.material_request_type
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
												}
											});
										}
									}
								});
							});
						}
					}
				});
				
				
			});
			
		}
	}
	
	
};
