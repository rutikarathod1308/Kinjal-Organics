frappe.ui.form.on("Sales Invoice", {
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
        //  setTimeout(() => {
         
        //     frm.remove_custom_button('Sales Order', 'Get Items From');
        //     frm.remove_custom_button('Quotation', 'Get Items From');
        //     frm.remove_custom_button('Delivery Note', 'Get Items From');
          
        // }, 100);
       
        // Add custom "Purchase Order" button under "Get Item From"
        frm.add_custom_button(__('Delivery Note'), function () {
            if (!frm.doc.customer) {
                frappe.throw({
                    title: __("Mandatory"),
                    message: __("Please Select a Customer")
                });
            }

               erpnext.utils.map_current_doc({
                method: "kinjal_organics.public.py.sales_order.make_sales_invoice",
                source_doctype: "Delivery Note",
                target: frm,
                setters: {
                    customer: frm.doc.customer || undefined,
                    posting_date : undefined,
                    set_warehouse: undefined
                },
                allow_child_item_selection: 1,
                child_fieldname: "items",
                child_columns: ["item_code", "rate","qty", "warehouse"],
                get_query_filters: {
                    docstatus: 1,
                    status: ["not in", ["Closed", "Completed", "Return Issued"]],
                    company: frm.doc.company,
                    per_billed: ["<", 99.99],
                  
                },
                callback: function () {
                    frappe.show_alert({ message: __("Items fetched from Delivery Note"), indicator: 'green' });
                    frm.refresh_field("items");
                }
            });


        }, __("Get Item From"));
    }
});

frappe.ui.form.on("Sales Invoice Item", {
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