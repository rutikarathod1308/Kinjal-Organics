frappe.ui.form.on("BOM", {
    refresh(frm) {

        frm.add_custom_button(__("Update BOM"), function () {

            let child_items = frm.doc.items || [];
            if (!child_items.length) {
                frappe.msgprint("No items to update.");
                return;
            }

            // Prepare data for dialog table
            let editable_data = child_items.map(row => ({
                original_item_code: row.item_code,
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
                        in_place_edit: false,
                        data: editable_data,

                        fields: [
                            {
                                fieldname: "item_code",
                                label: "Item Code",
                                fieldtype: "Link",
                                options: "Item",
                                reqd: 1,
                                in_list_view: true
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

                    let final_item_codes = updated_items.map(i =>
                        i.original_item_code || i.item_code
                    );

                    // Remove deleted rows in main items table
                    frm.doc.items = frm.doc.items.filter(row =>
                        final_item_codes.includes(row.item_code)
                    );

                    // Remove deleted rows in exploded items
                    if (frm.doc.exploded_items) {
                        frm.doc.exploded_items = frm.doc.exploded_items.filter(row =>
                            final_item_codes.includes(row.item_code)
                        );
                    }

                    // Update or add items
                    updated_items.forEach(updated => {
                        let original = updated.original_item_code || updated.item_code;

                        // ========== Main BOM Items ==========
                        let existing = frm.doc.items.find(r => r.item_code === original);

                        if (existing) {
                            existing.item_code = updated.item_code;
                            existing.item_name = updated.item_name;
                            existing.description = updated.description;
                            existing.uom = updated.uom;
                            existing.rate = updated.rate;
                            existing.qty = updated.qty;
                            existing.stock_qty = updated.qty * (existing.conversion_factor || 1);
                            existing.amount = updated.qty * updated.rate;
                            existing.base_rate = updated.rate;
                            existing.base_amount = updated.qty * updated.rate;
                            existing.include_item_in_manufacturing = 1;

                        } else {
                            let child = frm.add_child("items");
                            child.item_code = updated.item_code;
                            child.item_name = updated.item_name;
                            child.description = updated.description;
                            child.uom = updated.uom;
                            child.rate = updated.rate;
                            child.qty = updated.qty;
                            child.stock_qty = updated.qty;
                            child.amount = updated.qty * updated.rate;
                            child.base_rate = updated.rate;
                            child.base_amount = updated.qty * updated.rate;
                            child.include_item_in_manufacturing = 1;
                        }

                        // ========== Exploded Items ==========
                        if (!frm.doc.exploded_items) frm.doc.exploded_items = [];

                        let exploded = frm.doc.exploded_items.find(r => r.item_code === original);

                        if (exploded) {
                            exploded.item_code = updated.item_code;
                            exploded.item_name = updated.item_name;
                            exploded.description = updated.description;
                            exploded.uom = updated.uom;
                            exploded.rate = updated.rate;
                            exploded.stock_qty = updated.qty;
                            exploded.qty_consumed_per_unit = updated.qty / (frm.doc.qty || 1);
                            exploded.amount = updated.qty * updated.rate;
                            exploded.include_item_in_manufacturing = 1;

                        } else {
                            let ex = frm.add_child("exploded_items");
                            ex.item_code = updated.item_code;
                            ex.item_name = updated.item_name;
                            ex.description = updated.description;
                            ex.uom = updated.uom;
                            ex.rate = updated.rate;
                            ex.stock_qty = updated.qty;
                            ex.qty_consumed_per_unit = updated.qty / (frm.doc.qty || 1);
                            ex.amount = updated.qty * updated.rate;
                            ex.include_item_in_manufacturing = 1;
                        }
                    });

                    frm.refresh_field("items");
                    frm.refresh_field("exploded_items");

                    frm.save('Update').then(() => {
                        frappe.msgprint("BOM items updated successfully.");
                    });

                    d.hide();
                }
            });

            d.show();

            // ======================================================
            //   MORE ROBUST ITEM CODE CHANGE HANDLER (works for link pick & typing)
            // ======================================================
            let grid = d.fields_dict.items_table.grid;

            // Delegated handler: listens for multiple events on the input
            grid.wrapper.on("change input blur", "input[data-fieldname='item_code']", function (e) {
                // Attempt immediate read
                let $input = $(this);
                let item_code = $input.val();
                let row_name = $input.closest(".grid-row").attr("data-name");

                // Defensive: try to get row; if not available, we'll wait a short time and retry (link picker race)
                let get_row_doc = () => {
                    try {
                        let gr = grid.get_row(row_name);
                        return gr && gr.doc ? gr.doc : null;
                    } catch (err) {
                        console.warn("grid.get_row error", err);
                        return null;
                    }
                };

                let row_doc = get_row_doc();

                // If row not ready or item_code empty, wait a tick then retry once (handles link dialog race)
                if ((!row_doc || !row_name) && item_code) {
                    setTimeout(() => {
                        row_doc = get_row_doc();
                        if (!row_doc) {
                            console.warn("Could not find grid row after retry:", row_name);
                            return;
                        }
                        _fetch_and_set(item_code, row_doc, grid);
                    }, 150); // small delay to allow link value to settle
                    return;
                }

                if (!item_code || !row_doc) {
                    // nothing to do
                    return;
                }

                // Normal path
                _fetch_and_set(item_code, row_doc, grid);
            });

            // Helper function that fetches item details and updates the row doc
            function _fetch_and_set(item_code, row, gridRef) {
                console.log("Fetching Item:", item_code, "for row:", row.name || row);

                frappe.db.get_value("Item", item_code, ["item_name", "description", "stock_uom"])
                    .then(r => {
                        if (!r || !r.message) {
                            frappe.msgprint("Item not found: " + item_code);
                            return Promise.reject("Item not found");
                        }

                        row.item_name = r.message.item_name;
                        row.description = r.message.description;
                        row.uom = r.message.stock_uom;

                        // Now fetch price (optional; returns promise)
                        return frappe.db.get_value("Item Price",
                            { item_code: item_code, buying: 1 },
                            "price_list_rate"
                        );
                    })
                    .then(res => {
                        // If previous step failed with "Item not found", res will be undefined
                        if (res && res.message) {
                            row.rate = res.message.price_list_rate || 0;
                        } else {
                            // fallback 0 if no price found
                            row.rate = row.rate || 0;
                        }

                        // Refresh grid UI
                        try {
                            gridRef.refresh();
                        } catch (err) {
                            console.warn("grid.refresh failed", err);
                        }
                    })
                    .catch(err => {
                        // non-blocking: log and show friendly msg only when it's a real fetch error
                        if (err !== "Item not found") {
                            console.error("Error fetching item details:", err);
                            frappe.msgprint("Error fetching item details. See console for details.");
                        }
                    });
            }

            // ======================================================
            // DELETE ROW SYNC WITH BOM & EXPLODED ITEMS
            // ======================================================
            grid.wrapper.on("click", ".grid-remove-row", function () {

                let row_name = $(this).closest(".grid-row").attr("data-name");
                let rowObj = grid.get_row(row_name);
                let row = rowObj ? rowObj.doc : null;
                if (!row) return;

                let original = row.original_item_code || row.item_code;

                // Remove from main items
                let i = frm.doc.items.findIndex(r => r.item_code === original);
                if (i !== -1) frm.doc.items.splice(i, 1);

                // Remove from exploded items
                if (frm.doc.exploded_items) {
                    let e = frm.doc.exploded_items.findIndex(r => r.item_code === original);
                    if (e !== -1) frm.doc.exploded_items.splice(e, 1);
                }

                frm.refresh_field("items");
                frm.refresh_field("exploded_items");
                frm.save('Update');
            });

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
