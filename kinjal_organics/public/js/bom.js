frappe.ui.form.on("BOM", {
    refresh(frm) {
        frm.add_custom_button(__("Update BOM"), function () {

            let child_items = frm.doc.items || [];

            if (!child_items.length) {
                frappe.msgprint("No items to update.");
                return;
            }

            // Prepare editable data
            let editable_data = child_items.map(row => ({
                original_item_code: row.item_code,   // needed for delete + update tracking
                item_code: row.item_code,
                item_name: row.item_name,
                description: row.description,
                qty: row.qty,
                uom: row.uom,
                rate: row.rate
            }));

            let d = new frappe.ui.Dialog({
                title: "Update BOM Items",
                fields: [
                {
                    fieldname: "items_table",
                    label: "Items",
                    fieldtype: "Table",
                    cannot_add_rows: false,
                    in_place_edit: false,     // <<< IMPORTANT (shows pencil icon)
                    data: editable_data,

                    fields: [
                        {
                            fieldname: "item_code",
                            label: "Item Code",
                            fieldtype: "Link",
                            options: "Item",
                            reqd: 1,
                            in_list_view: true,
                            onchange: function () { 
                                const item_value = this.get_value(); 
                                if (!item_value) return;

                                // Fetch item details and rate in a promise chain
                                frappe.db.get_value("Item", item_value, ["item_name", "description", "stock_uom"])
                                    .then(r => {
                                        if (r.message) {
                                            this.grid_row.doc.item_name = r.message.item_name;
                                            this.grid_row.doc.description = r.message.description;
                                            this.grid_row.doc.uom = r.message.stock_uom;
                                        } else {
                                            frappe.msgprint(`Item ${item_value} not found.`);
                                            return;
                                        }

                                        // Fetch rate (purchase rate for BOM)
                                        return frappe.db.get_value("Item Price", { item_code: item_value, buying: 1 }, "price_list_rate");
                                    })
                                    .then(res => {
                                        this.grid_row.doc.rate = res.message?.price_list_rate || 0;
                                        // Refresh the grid after all updates
                                        this.grid_row.grid.refresh();
                                    })
                                    .catch(err => {
                                        console.error("Error fetching item details:", err);
                                        frappe.msgprint("Error fetching item details. Please check the item code.");
                                    });
                            }
                        },
                        {
                            fieldname: "item_name",
                            label: "Item Name",
                            fieldtype: "Data",
                            read_only: 1,
                            in_list_view: true
                        },
                        {
                            fieldname: "qty",
                            label: "Qty",
                            fieldtype: "Float",
                            reqd: 1,
                            in_list_view: true
                        },
                        {
                            fieldname: "uom",
                            label: "UOM",
                            fieldtype: "Link",
                            options: "UOM",
                            reqd: 1,
                            in_list_view: true
                        },
                        {
                            fieldname: "rate",
                            label: "Rate",
                            fieldtype: "Currency",
                            in_list_view: true
                        },
                        {
                            fieldname: "description",
                            label: "Description",
                            fieldtype: "Data",
                            read_only: 1,
                            in_list_view: true
                        }
                    ]
                }
            ],

                primary_action_label: "Update",
                primary_action(values) {
                    let updated_items = values.items_table || [];

                    // -------------------------------------------------------
                    // 1️⃣ GET FINAL LIST OF ITEM CODES FROM DIALOG
                    // -------------------------------------------------------
                    let final_item_codes = updated_items.map(i => i.original_item_code || i.item_code);

                    // -------------------------------------------------------
                    // 2️⃣ REMOVE DELETED ITEMS FROM MAIN ITEMS TABLE
                    // -------------------------------------------------------
                    frm.doc.items = frm.doc.items.filter(row =>
                        final_item_codes.includes(row.item_code)
                    );

                    // -------------------------------------------------------
                    // 3️⃣ REMOVE DELETED ITEMS FROM EXPLODED TABLE
                    // -------------------------------------------------------
                    if (frm.doc.exploded_items) {
                        frm.doc.exploded_items = frm.doc.exploded_items.filter(row =>
                            final_item_codes.includes(row.item_code)
                        );
                    }

                    // -------------------------------------------------------
                    // 4️⃣ UPDATE OR ADD ITEMS
                    // -------------------------------------------------------
                    updated_items.forEach(updated => {
                        let original = updated.original_item_code || updated.item_code;

                        // ------- UPDATE ITEMS TABLE -------
                        let existing = frm.doc.items.find(r => r.item_code === original);

                        if (existing) {
                            existing.item_code = updated.item_code;
                            existing.item_name = updated.item_name;
                            existing.description = updated.description;
                            existing.uom = updated.uom;
                            existing.rate = updated.rate;
                            existing.base_rate = updated.rate;
                            existing.qty = updated.qty;
                            existing.stock_qty = updated.qty * (existing.conversion_factor || 1);
                            existing.amount = updated.qty * updated.rate ;
                            existing.base_amount = updated.qty * updated.rate ;
                            existing.include_item_in_manufacturing = 1 ;
                        } else {
                            let child = frm.add_child("items");
                            child.item_code = updated.item_code;
                            child.item_name = updated.item_name;
                            child.description = updated.description;
                            child.uom = updated.uom;
                            child.rate = updated.rate;
                            child.base_rate = updated.rate;
                            child.qty = updated.qty;
                            child.stock_qty = updated.qty;
                            child.amount = updated.qty * updated.rate ;
                            child.base_amount = updated.qty * updated.rate ;
                            existing.include_item_in_manufacturing = 1 ;
                        }

                        // ------- UPDATE EXPLODED ITEMS -------
                        if (!frm.doc.exploded_items) frm.doc.exploded_items = [];

                        let exploded = frm.doc.exploded_items.find(r =>
                            r.item_code === original
                        );

                        if (exploded) {
                            exploded.item_code = updated.item_code;
                            exploded.item_name = updated.item_name;
                            exploded.description = updated.description;
                            exploded.uom = updated.uom;
                            exploded.rate = updated.rate;
                            exploded.stock_qty = updated.qty;
                            exploded.qty_consumed_per_unit = updated.qty / frm.doc.qty;
                            exploded.amount = updated.qty * updated.rate ; 
                            exploded.include_item_in_manufacturing = 1 ;
                        } else {
                            let ex = frm.add_child("exploded_items");
                            ex.item_code = updated.item_code;
                            ex.item_name = updated.item_name;
                            ex.description = updated.description;
                            ex.uom = updated.uom;
                            ex.rate = updated.rate;
                            ex.stock_qty = updated.qty;
                            ex.qty_consumed_per_unit = updated.qty / frm.doc.qty;
                            ex.amount = updated.qty * updated.rate ;   
                            ex.include_item_in_manufacturing = 1 ;
                        }
                    });

                    frm.refresh_field("items");
                    frm.refresh_field("exploded_items");

                    frm.save('Update').then(() => {
                        frappe.msgprint("BOM items & exploded items updated successfully.");
                    });

                    d.hide();
                }
            });

            d.show();

            // ⭐ EVENTS: AUTO SAVE + DELETE SYNC + ADD SYNC
            let grid = d.fields_dict.items_table.grid;

            // ---------------------- DELETE ROW HANDLER ----------------------
            grid.wrapper.on("click", ".grid-remove-row", function () {

                let row_name = $(this).closest(".grid-row").attr("data-name");
                let row = grid.get_row(row_name).doc;
                if (!row) return;

                let original = row.original_item_code || row.item_code;

                // remove from items
                let i = frm.doc.items.findIndex(r => r.item_code === original);
                if (i !== -1) frm.doc.items.splice(i, 1);

                // remove from exploded
                if (frm.doc.exploded_items) {
                    let e = frm.doc.exploded_items.findIndex(r => r.item_code === original);
                    if (e !== -1) frm.doc.exploded_items.splice(e, 1);
                }

                frm.refresh_field("items");
                frm.refresh_field("exploded_items");

                // ⭐ AUTO SAVE AFTER DELETE
                frm.save('Update');
            });

            // // ---------------------- ADD ROW HANDLER -------------------------
            // grid.on('row-add', function (row) {

            //     // assign original code if new
            //     if (!row.doc.original_item_code && row.doc.item_code) {
            //         row.doc.original_item_code = row.doc.item_code;
            //     }

            //     // ⭐ auto-save after adding
            //     frm.save('Update');
            // });

        });
    }
});


// -------------------- FETCH ITEM DETAILS -----------------------
function fetch_item_details(row, dialog) {

    if (!row.item_code) return;

    frappe.db.get_value("Item", row.item_code,
        ["item_name", "description", "stock_uom"]
    ).then(r => {
        if (r.message) {
            row.item_name = r.message.item_name;
            row.description = r.message.description;
            row.uom = r.message.stock_uom;

            dialog.fields_dict.items_table.grid.refresh();
        }
    });

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Bin",
            filters: { item_code: row.item_code },
            fieldname: "valuation_rate"
        }
    }).then(res => {
        row.rate = res.message?.valuation_rate || 0;
        dialog.fields_dict.items_table.grid.refresh();
    });
}

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
        frm.fields.forEach(function(field) {
 if (field.df.fieldname !== 'is_active' && field.df.fieldname !== 'is_default') {
                    field.df.read_only = 1;
                }


});
// Refresh form fields
frm.refresh_fields();
    }
    }
});
