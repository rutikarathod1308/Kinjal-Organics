frappe.ui.form.on('Purchase Invoice', {
    refresh: function (frm) {
        let user_roles = frappe.user_roles; // Gets the roles of the current user
        // console.log(user_roles); // Use console.log instead of print
        for(var i = 0; i < user_roles.length; i++) {
            if(user_roles[i] == "FIFO Advance"){
                frm.set_df_property('allocate_advances_automatically', 'read_only', 0);
            }
            else{
                frm.set_df_property('allocate_advances_automatically', 'read_only', 1);
            }
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

                        // Save item-wise warehouses to the map
                        item_warehouse_map[row.item_code] = valid_warehouses;

                        // Set query for the child 'warehouse' field (row-wise)
                        if(valid_warehouses.length > 0){
                        frm.fields_dict["items"].grid.get_field("warehouse").get_query = function(doc, cdt, cdn) {
                            let child_row = locals[cdt][cdn];
                            let item_code = child_row.item_code;
                            return {
                                filters: {
                                    name: ['in', item_warehouse_map[item_code] || []]
                                }
                            };
                        };
                    }
                        if(parent_warehouse_list.length > 0){
                           
                            frm.set_query("purchase_warehouse", () => {
                                return {
                                    filters: {
                                        name: ["in", [...new Set(parent_warehouse_list)]]
                                    }
                                };
                            });
                        }
                        
                        // Set query for the parent 'set_warehouse' field
                       
                    }
                }
            });
        });
    }
})

