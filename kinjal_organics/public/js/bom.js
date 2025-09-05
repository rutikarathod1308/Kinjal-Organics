frappe.ui.form.on("BOM", {
    refresh: function(frm) {
        
        frm.add_custom_button(__("Update BOM"), function() {
            let child_items = frm.doc.items || [];

            if (!child_items.length) {
                frappe.msgprint("No items to update.");
                return;
            }

            let editable_data = child_items.map(row => ({
                original_item_code: row.item_code,
                item_code: row.item_code,
                qty: row.qty,
                item_name: row.item_name
            }));

            let d = new frappe.ui.Dialog({
                title: "Update BOM Items",
                fields: [
                    {
                        label: "Items",
                        fieldname: "items_table",
                        fieldtype: "Table",
                        cannot_add_rows: true,
                        in_place_edit: true,
                        data: editable_data,
                        fields: [
                            {
                                fieldname: "item_code",
                                label: "Item Code",
                                fieldtype: "Link",
                                options: "Item",
                                reqd: 1,
                                in_list_view: true,
                                change: function(df, row) {
                                    if (row.item_code) {
                                        frappe.db.get_value("Item", row.item_code, "item_name").then(r => {
                                            if (r.message && r.message.item_name) {
                                                row.item_name = r.message.item_name;
                                                d.fields_dict.items_table.grid.refresh();
                                            }
                                        });
                                    }
                                }
                            },
                            {
                                fieldname: "qty",
                                label: "Qty",
                                fieldtype: "Float",
                                reqd: 1,
                                in_list_view: true
                            },
                          
                        ]
                    }
                ],
                primary_action_label: "Update",
                primary_action(values) {
                    let updated_items = values.items_table;

                    frappe.call({
                        method: "frappe.client.get_list",
                        args: {
                            doctype: "Item",
                            filters: {
                                name: ["in", updated_items.map(i => i.item_code)]
                            },
                            fields: ["name", "item_name","description"]
                        },
                        callback: function(r) {
                            let item_name_map = {};
                            let item_description_map = {};
                            (r.message || []).forEach(item => {
                                item_name_map[item.name] = item.item_name;
                                item_description_map[item.name] = item.description;
                            });

                            updated_items.forEach(updated => {
                                let original_code = updated.original_item_code;
                                let new_name = item_name_map[updated.item_code] || "";
                                let new_description = item_description_map[updated.item_code] || "";

                                // Update in 'items'
                                let item_row = frm.doc.items.find(r => r.item_code === original_code);
                                if (item_row) {
                                    item_row.item_code = updated.item_code;
                                    item_row.item_name = new_name;
                                    item_row.description = new_description;
                                    item_row.qty = updated.qty;
                                    item_row.stock_qty = updated.qty * item_row.conversion_factor;
                                }

                                // Update in 'exploded_items'
                                let exploded_row = frm.doc.exploded_items?.find(r => r.item_code === original_code);
                                if (exploded_row) {
                                    exploded_row.item_code = updated.item_code;
                                    exploded_row.item_name = new_name;
                                    exploded_row.description = new_description;
                                    exploded_row.stock_qty = updated.qty;

                                }
                            });

                            frm.refresh_field("items");
                            frm.refresh_field("exploded_items");

                            frm.save().then(() => {
                                frappe.msgprint("BOM items updated successfully.");
                            });

                            d.hide();
                        }
                    });
                }
            });

            d.show();
        });
        
    }
});

frappe.ui.form.on("BOM", {
    onload: function(frm) {
        if(cur_frm.doc.docstatus === 1){
        const child_doctype = "BOM Item";
        const readOnlyFields = ["item_code", "qty", "item_name", "description"];

        readOnlyFields.forEach(fieldname => {
            const df = frappe.meta.get_docfield(child_doctype, fieldname, frm.doc.name);
            if (df) {
                df.read_only = 1;
            }
        });
    }
    }
});
