frappe.ui.form.on("Sales Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    }
});


frappe.ui.form.on("Sales Order", {
    refresh: function (frm) {
        if (frm.doc.workflow_state === "Re-Approve") {
            

            // Clear the entire 'Create' dropdown menu
            frm.page.clear_menu();

            // Try removing custom buttons (if any were added)
            frm.remove_custom_button('Update Items');
            
            // Hide standard buttons via jQuery if needed (risky, not recommended for long term)
            setTimeout(() => {
                $("button:contains('Update Items')").hide();
                $("button:contains('Create')").hide();
            }, 100);
        }
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
    }
});

frappe.ui.form.on("Sales Order Item", {
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
