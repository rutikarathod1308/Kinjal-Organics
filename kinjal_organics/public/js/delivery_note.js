frappe.ui.form.on("Delivery Note", {
    refresh: function(frm) {
        let parent_warehouse_list = [];
        let item_warehouse_map = {}; // To store warehouses per item_code

        (frm.doc.items || []).forEach(row => {
            if (!row.item_code) return;

            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Item",
                    name: row.item_code
                },
                callback: function(res) {
                    if (res.message && res.message.custom_warehouse_item) {
                        let valid_warehouses = [];

                        res.message.custom_warehouse_item.forEach(w => {
                            if (w.company === frm.doc.company) {
                                valid_warehouses.push(w.warehouse);
                                parent_warehouse_list.push(w.warehouse);
                            }
                        });
                        if(valid_warehouses.length > 0 ){}
                        // Save item-wise warehouses to the map
                        item_warehouse_map[row.item_code] = valid_warehouses;

                        // Set query for the child 'warehouse' field (row-wise)
                        frm.fields_dict["items"].grid.get_field("warehouse").get_query = function(doc, cdt, cdn) {
                            let child_row = locals[cdt][cdn];
                            let item_code = child_row.item_code;
                            return {
                                filters: {
                                    name: ['in', item_warehouse_map[item_code] || []]
                                }
                            };
                        };
                    
                        if(parent_warehouse_list.length > 0){
                        // Set query for the parent 'set_warehouse' field
                        frm.set_query("set_warehouse", () => {
                            return {
                                filters: {
                                    name: ["in", [...new Set(parent_warehouse_list)]]
                                }
                            };
                        });
                    }
                    }
                }
            });
        });
         setTimeout(() => {
         
            frm.remove_custom_button('Sales Order', 'Get Items From');
            frm.remove_custom_button('Sales Invoice', 'Get Items From');
          
        }, 100);
        if(frm.doc.docstatus > 0) {
			cur_frm.add_custom_button(__("Stock Ledger Kinjal"), function() {
				frappe.route_options = {
					voucher_no: frm.doc.name,
					from_date: frm.doc.posting_date,
					to_date: moment(frm.doc.modified).format('YYYY-MM-DD'),
					company: frm.doc.company,
					show_cancelled_entries: frm.doc.docstatus === 2,
					ignore_prepared_report: true
				};
				frappe.set_route("query-report", "Stock Ledger Chemical");
			}, __("View"));
		}
        if(frm.doc.docstatus != 1){
        // Add custom "Purchase Order" button under "Get Item From"
        frm.add_custom_button(__('Sales Order'), function () {
            if (!frm.doc.customer) {
                frappe.throw({
                    title: __("Mandatory"),
                    message: __("Please Select a Customer")
                });
            }

               erpnext.utils.map_current_doc({
                method: "kinjal_organics.public.py.delivery_note.make_delivery_note",
                source_doctype: "Sales Order",
                target: frm,
                setters: {
                    customer: frm.doc.customer || undefined,
                    transaction_date : undefined,
                    set_warehouse: undefined
                },
                allow_child_item_selection: 1,
                child_fieldname: "items",
                child_columns: ["item_code", "rate","custom_pending_qty", "warehouse"],
                get_query_filters: {
                    docstatus: 1,
                    status: ["not in", ["Closed", "Completed", "Return Issued"]],
                    company: frm.doc.company,
                    per_billed: ["<", 99.99],
                    workflow_state: ["not in", ["Re-Approve"]],
                },
                callback: function () {
                    frappe.show_alert({ message: __("Items fetched from Sales Order"), indicator: 'green' });
                    frm.refresh_field("items");
                }
            });


        }, __("Get Item From"));
    }
    }
});

frappe.ui.form.on("Delivery Note Item", {
    item_code: function(frm,cdt,cdn) {
        let row = locals[cdt][cdn];
        let parent_warehouse_list = [];
        let item_warehouse_map = {}; // To store warehouses per item_code

       
            if (!row.item_code) return;

            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Item",
                    name: row.item_code
                },
                callback: function(res) {
                    if (res.message && res.message.custom_warehouse_item) {
                        let valid_warehouses = [];

                        res.message.custom_warehouse_item.forEach(w => {
                            if (w.company === frm.doc.company) {
                                valid_warehouses.push(w.warehouse);
                                parent_warehouse_list.push(w.warehouse);
                            }
                        });
                        if(valid_warehouses.length > 0 ){}
                        // Save item-wise warehouses to the map
                        item_warehouse_map[row.item_code] = valid_warehouses;

                        // Set query for the child 'warehouse' field (row-wise)
                        frm.fields_dict["items"].grid.get_field("warehouse").get_query = function(doc, cdt, cdn) {
                            let child_row = locals[cdt][cdn];
                            let item_code = child_row.item_code;
                            return {
                                filters: {
                                    name: ['in', item_warehouse_map[item_code] || []]
                                }
                            };
                        };
                    
                        if(parent_warehouse_list.length > 0){
                        // Set query for the parent 'set_warehouse' field
                        frm.set_query("set_warehouse", () => {
                            return {
                                filters: {
                                    name: ["in", [...new Set(parent_warehouse_list)]]
                                }
                            };
                        });
                    }
                    }
                }
            });
     
    }
});

frappe.ui.form.on("Delivery Note", {
    validate: async function (frm) {
        for (let row of frm.doc.items || []) {
            if (row.against_sales_order) {
                const r = await frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Sales Order",
                        name: row.against_sales_order
                    }
                });

                if (r.message && r.message.workflow_state === "Re-Approve") {
                    frappe.throw(__(" linked Sales Order {0} is in 'Re-Approve'. Please Aprroved Sales Order.", [row.against_sales_order]));
                }
            }
        }
    }
});

frappe.ui.form.on("Delivery Note", {
    on_submit: async function (frm) {
        for (let row of frm.doc.items || []) {
            if (row.against_sales_order) {
                const r = await frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Sales Order",
                        name: row.against_sales_order
                    }
                });

                if (r.message && r.message.workflow_state === "Re-Approve") {
                    frappe.throw(__(" linked Sales Order {0} is in 'Re-Approve'. Please Aprroved Sales Order.", [row.against_sales_order]));
                }
            }
        }
    }
});
