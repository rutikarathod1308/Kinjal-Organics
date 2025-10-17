frappe.ui.form.on("Purchase Receipt", {
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
frappe.ui.form.on("Purchase Receipt Item", {
    item_code: function(frm,cdt,cdn) {
        
        let row = locals[cdt][cdn];
        if(row.item_group == "RAW MATERIAL" || row.item_group == "By product" || row.item_group == "FINISH GOODS"){
             frm.fields_dict['items'].grid.grid_rows_by_docname[cdn].toggle_editable('qty', false);
        }
        else{
           frm.fields_dict['items'].grid.grid_rows_by_docname[cdn].toggle_editable('qty', true);
        }
    }
})
frappe.ui.form.on("Purchase Receipt", {
    refresh: function(frm) {
        for (let row of frm.doc.items || []) {
             if(row.item_group == "RAW MATERIAL" || row.item_group == "By product" || row.item_group == "FINISH GOODS"){
                console.log("If condition worked")
                frm.fields_dict['items'].grid.grid_rows_by_docname[row.name].toggle_editable('qty', false);
             }
             else{
                console.log("else condition worked")
                 frm.fields_dict['items'].grid.grid_rows_by_docname[row.name].toggle_editable('qty', true);
             }
        }
    }
})
function set_qty_editable_for_row(frm, row) {
    if (!row) return;

    // safe access to grid row
    const grid = frm.fields_dict['items'] && frm.fields_dict['items'].grid;
    if (!grid) return;
    const grid_row = grid.grid_rows_by_docname[row.name];
    if (!grid_row) return;

    const rawGroups = ['Raw Material', 'By Product', 'Finish Goods'];
    const isRawGroup = (g) => {
        return rawGroups.some(x => (x || '').toLowerCase() === (g || '').toLowerCase());
    };

    // If item_group exists on the child row, use it directly
    if (row.item_group) {
        grid_row.toggle_editable('qty', !isRawGroup(row.item_group));
        return;
    }

    // If item_group is missing but item_code is present, fetch item_group asynchronously
    if (row.item_code) {
        frappe.db.get_value('Item', row.item_code, 'item_group').then(r => {
            const ig = (r.message && r.message.item_group) || '';
            // set the child row's item_group (so subsequent checks are fast)
            frappe.model.set_value(row.doctype, row.name, 'item_group', ig);
            const editable = !isRawGroup(ig);
            const grid_row_now = frm.fields_dict['items'].grid.grid_rows_by_docname[row.name];
            if (grid_row_now) grid_row_now.toggle_editable('qty', editable);
        });
        return;
    }

    // default: editable
    grid_row.toggle_editable('qty', true);
}

// child table events
frappe.ui.form.on('Purchase Receipt Item', {
    form_render: function(frm, cdt, cdn) {
        set_qty_editable_for_row(frm, locals[cdt][cdn]);
    },
    item_code: function(frm, cdt, cdn) {
        // when item_code changes, recalc for this row
        set_qty_editable_for_row(frm, locals[cdt][cdn]);
    }
});

// parent form events
frappe.ui.form.on('Purchase Receipt', {
    refresh: function(frm) {
        // let grid rows render first
        setTimeout(() => {
            for (let row of frm.doc.items || []) {
                set_qty_editable_for_row(frm, row);
            }
        }, 0);
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
        const valid_groups = ["RAW MATERIAL", "By product", "FINISH GOODS"];

        // Check if item_group matches any of the valid ones
        if (valid_groups.includes(row.item_group)) {
            const net = flt(row.net_weight);
            const bill = flt(row.custom_billing_weight);

            if (net && bill) {
                const lower_value = Math.min(net, bill);
                frappe.model.set_value(cdt, cdn, "qty", lower_value);
            }
        }
    }
})

frappe.ui.form.on("Purchase Receipt Item", {
    net_weight: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
      
        const valid_groups = ["RAW MATERIAL", "By product", "FINISH GOODS"];

        // Check if item_group matches any of the valid ones
        if (valid_groups.includes(row.item_group)) {
            const net = flt(row.net_weight);
            const bill = flt(row.custom_billing_weight);

            if (net && bill) {
                const lower_value = Math.min(net, bill);
                frappe.model.set_value(cdt, cdn, "qty", lower_value);
            }
        }
    }
})


