frappe.ui.form.on("BOM", {
    refresh: function(frm) {
        frm.add_custom_button(__("Update BOM"), function() {
            let child_items = frm.doc.items || [];

            if (!child_items.length) {
                frappe.msgprint("No items to update.");
                return;
            }

            // Create the dialog
            let d = new frappe.ui.Dialog({
                title: "Update BOM Items",
                fields: [
                    {
                        label: "Items",
                        fieldname: "items_table",
                        fieldtype: "Table",
                        cannot_add_rows: false,
                        in_place_edit: true,
                        data: child_items.map(row => ({
                            item_code: row.item_code,
                            qty: row.qty
                        })),
                        fields: [
                            {
                                fieldname: "item_code",
                                label: "Item Code",
                                fieldtype: "Link",
                                options: "Item",
                                in_list_view: true,
                                read_only: true // Don't allow item_code change
                            },
                            {
                                fieldname: "qty",
                                label: "Qty",
                                fieldtype: "Float",
                                in_list_view: true
                            }
                        ]
                    }
                ],
                primary_action_label: "Update",
                primary_action(values) {
                    let updated_items = values.items_table;

                    updated_items.forEach(updated => {
                        // Update 'items' child table
                        let row = frm.doc.items.find(r => r.item_code === updated.item_code);
                        if (row) {
                            row.qty = updated.qty;
                            row.stock_qty = updated.qty * row.conversion_factor;
                        }

                        // Update 'exploded_items' child table
                        let row_explode = frm.doc.exploded_items?.find(r => r.item_code === updated.item_code);
                        if (row_explode) {
                            row_explode.stock_qty = updated.qty;
                        }
                    });

                    frm.refresh_field("items");
                    frm.refresh_field("exploded_items");

                    // Save the document so changes persist after reload
                    frm.save().then(() => {
                        frappe.msgprint("Items updated and saved successfully.");
                    });

                    d.hide();
                }
            });

            d.show();
        });
    }
});
