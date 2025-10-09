frappe.ui.form.on("Purchase Receipt", {
    refresh: function(frm) {
        
               // Clear the entire 'Create' dropdown menu
        
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

frappe.ui.form.on("Purchase Receipt Item", {
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


frappe.ui.form.on("Purchase Receipt", {
    refresh: function(frm) {
        // Hide default buttons
        $("button:contains('Get Items From')").hide();
        if (frm.doc.docstatus == 0){
  // Add custom "Purchase Order" button under "Get Item From"
        frm.add_custom_button(__('Purchase Order'), function () {
            if (!frm.doc.supplier) {
                frappe.throw({
                    title: __("Mandatory"),
                    message: __("Please Select a Supplier")
                });
            }

            erpnext.utils.map_current_doc({
                method: "kinjal_organics.public.py.purchase_receipt.make_purchase_receipt",
                source_doctype: "Purchase Order",
                target: frm,
                setters: {
                    supplier: frm.doc.supplier,
                    set_warehouse: undefined,
                    schedule_date: undefined
                },
                allow_child_item_selection: 1,
                child_fieldname: "items", // child table fieldname in Purchase Order
                child_columns: ["item_code", "custom_pending_qty", "rate", "schedule_date"], // columns to show in dialog
                get_query_filters: {
                    docstatus: 1,
                    status: ["not in", ["Closed", "On Hold"]],
                    workflow_state: ["not in", ["Re-Approve"]],
                    per_received: ["<", 99.99],
                    company: frm.doc.company
                },
                callback: function() {
                    // After mapping, update custom field 'custom_raw_value' in child rows
                    frm.doc.items.forEach(row => {
                        if (row.item_code) {
                            frappe.model.set_value(row.doctype, row.name, 'custom_raw_value', row.item_code.toUpperCase());
                        }
                    });
                    frm.refresh_field('items');
                    frappe.show_alert({ message: __("Items fetched from Purchase Order"), indicator: 'green' });
                }
            });

        }, __("Get Item From"));
        }
      
    }
});

frappe.ui.form.on("Purchase Receipt", {
    validate: async function (frm) {
       
        for (let row of frm.doc.items || []) {
            if (row.purchase_order) {
                const r = await frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Purchase Order",
                        name: row.purchase_order
                    }
                });

                if (r.message && r.message.workflow_state === "Re-Approve") {
                    frappe.throw(__(" linked Purchase Order {0} is in 'Re-Approve' Please Aprroved Purchase Order.", [row.purchase_order]));
                }
            }
        }
    }
});


frappe.ui.form.on("Purchase Receipt", {
    async on_submit(frm) {
        for (let row of frm.doc.items || []) {
            if (row.purchase_order) {
                const r = await frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Purchase Order",
                        name: row.purchase_order
                    }
                });

                if (r.message && r.message.workflow_state === "Re-Approve") {
                    frappe.throw(
                        __("Linked Purchase Order {0} is in 'Re-Approve'. Please approve the Purchase Order before submitting.", [row.purchase_order])
                    );
                }
            }
        }
    }
});




frappe.ui.form.on("Purchase Receipt Item", {
    custom_gross_weight: function(frm, cdt, cdn) {
        calculate_total_weight(frm, cdt, cdn);
    },
    custom_tare_weght: function(frm, cdt, cdn) {
        calculate_total_weight(frm, cdt, cdn);
    }
});

function calculate_total_weight(frm, cdt, cdn) {
    let row = locals[cdt][cdn];

    // Ensure both values are valid numbers
    let gross = flt(row.custom_gross_weight);
    let tare = flt(row.custom_tare_weght);

    if (gross > 0 && tare >= 0) {
        var total_weight = gross - tare;
        console.log(total_weight)
        frappe.model.set_value(cdt, cdn, "net_weight", total_weight);
    } else {
        frappe.model.set_value(cdt, cdn, "net_weight", 0);
    }
}

frappe.ui.form.on("Purchase Receipt Item", {
    custom_billing_weight: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        var shortage = row.net_weight - row.custom_billing_weight
        frappe.model.set_value(cdt,cdn,"shortage_qty",shortage)
    }
})