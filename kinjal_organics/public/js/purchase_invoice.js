frappe.ui.form.on('Purchase Invoice', {
    refresh: function (frm) {
      
     
    frappe.call({
                method: 'kinjal_organics.public.py.payment_entry.get_selected_fifo_roles',
                callback: function (r) {
                    const role_type = r.message;
                    console.log(role_type)
                    if (role_type === "FIFO") {
                        
                        frm.set_df_property('allocate_advances_automatically', 'read_only', 0);
                    } 

                    frm.refresh_field('payment_type');
                }
            });
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
           setTimeout(() => {
            frm.remove_custom_button('Update Items');
            frm.remove_custom_button('Purchase Order', 'Get Items From');
            frm.remove_custom_button('Purchase Receipt', 'Get Items From');
            frm.remove_custom_button('Purchase Receipt', 'Create');
            frm.remove_custom_button('Subscription', 'Create');
            
        }, 200);
       if(frm.doc.docstatus != 1){

       
        // Add custom "Purchase Order" button under "Get Item From"
        frm.add_custom_button(__('Purchase Receipt'), function () {
            if (!frm.doc.supplier) {
                frappe.throw({
                    title: __("Mandatory"),
                    message: __("Please Select a Supplier")
                });
            }

                erpnext.utils.map_current_doc({
                method: "kinjal_organics.public.py.purchase_invoice.make_purchase_invoice",  // path must match actual Python file
                source_doctype: "Purchase Receipt",  // this was the mistake!
                target: frm,
                setters: {
                    supplier: me.frm.doc.supplier || undefined,
                    posting_date: undefined,
                    set_warehouse: undefined,
                    supplier_delivery_note: undefined
                },
                allow_child_item_selection: 1,
                child_fieldname: "items",
                child_columns: ["item_code", "received_qty","warehouse"],
                get_query_filters: {
                    docstatus: 1,
                    status: ["not in", ["Closed", "Completed", "Return Issued"]],
                    company: frm.doc.company,
                    is_return: 0,
                    per_billed: ["<", 99.99],
                    
                
                },
                callback: function() {
                    frm.doc.items.forEach(row => {
                        if (row.item_code) {
                            frm.clear_table("items")
                            frappe.model.set_value(row.doctype, row.name, 'custom_raw_value', row.item_code.toUpperCase());
                        }
                    });
                    frm.refresh_field('items');
                    frappe.show_alert({ message: __("Items fetched from Purchase Receipt"), indicator: 'green' });
                }
            });


        }, __("Get Item From"));
    }
        frm.add_custom_button(__('Kasar Voucher'), function () {
            var journal_entry = frappe.model.get_new_doc('Journal Entry');
            journal_entry.voucher_type = "Journal Entry";
            journal_entry.company = frm.doc.company;
            journal_entry.posting_date = frm.doc.posting_date;
            var row1 = frappe.model.add_child(journal_entry, "Journal Entry Account", "accounts");
            row1.account = "KASAR VATAV - KOPL",
            row1.credit_in_account_currency = frm.doc.outstanding_amount,
            row1.debit_in_account_currency = 0.0

            var row2 = frappe.model.add_child(journal_entry, "Journal Entry Account", "accounts");    
            row2.account= frm.doc.credit_to,
            row2.party_type= "Supplier",
            row2.party= frm.doc.supplier, // change this to match your party
            row2.debit_in_account_currency= frm.doc.outstanding_amount,
            row2.credit_in_account_currency= 0.0,
            row2.reference_type= "Purchase Invoice",
            row2.reference_name= frm.doc.name // adjust dynamically if needed
          
            

            frappe.set_route('Form',"Journal Entry",journal_entry.name);


        }, __("Create"));
    }
})

frappe.ui.form.on("Purchase Invoice", {
    before_save: function(frm) {
        var total_deduct_amount = 0;
          (frm.doc.items || []).forEach(row => {
            frappe.call({
    method: "frappe.client.get",
    args: {
        doctype: "Item",
        name: row.item_code,
    },
    callback: function (res) {
        if (res.message && res.message.custom_shortage) {
            // Calculate shortage quantity from custom_shortage %
            let allowed_shortage_qty = (row.qty * res.message.custom_shortage) / 100;

            // Only deduct if actual shortage is more than allowed
            if (row.shortage_qty > allowed_shortage_qty) {
                let shortage_amount = (row.shortage_qty) * row.rate;

                // Set the value in the child table row
                frappe.model.set_value(row.doctype, row.name, "deduct_amount", shortage_amount);
                total_deduct_amount += shortage_amount;
                  frm.set_value("total_deduct_amount",total_deduct_amount)
         frm.refresh_field('total_deduct_amount');
            }
            else{
                   total_deduct_amount += row.deduct_amount;
                    frm.set_value("total_deduct_amount",total_deduct_amount)
         frm.refresh_field('total_deduct_amount');
            }
          
        }
    }
});

          
       
          })
          
      
    },
   
});


frappe.ui.form.on("Purchase Invoice", {
    onload(frm) {
        frappe.after_ajax(() => {
            setup_gstin_observer(frm);
        });
    },
    refresh(frm) {
        frappe.after_ajax(() => {
            setup_gstin_observer(frm);
        });
    },
     supplier(frm) {
        frappe.after_ajax(() => {
            setup_gstin_observer(frm);
        });
    }
});

function setup_gstin_observer(frm) {
    let wrapper = frm.fields_dict["address_display"]?.$wrapper;
    if (!wrapper || !wrapper.length) return;

    // Disconnect old observer
    if (frm._gstin_observer) {
        frm._gstin_observer.disconnect();
    }

    // New observer
    const observer = new MutationObserver(() => {
        remove_gstin_text(wrapper);
    });

    observer.observe(wrapper[0], {
        childList: true,
        subtree: true,
        characterData: true,
    });

    frm._gstin_observer = observer;

    // Run once immediately
    remove_gstin_text(wrapper);
}

function remove_gstin_text(wrapper) {
    wrapper.find('*').contents().filter(function () {
        return this.nodeType === 3 && this.nodeValue.includes("GSTIN");
    }).each(function () {
        this.nodeValue = this.nodeValue.replace(/GSTIN:\s*[A-Z0-9]+/i, "");
    });
}






frappe.ui.form.on('Purchase Invoice', {
    supplier(frm) {
        frappe.after_ajax(() => {
           
                // Mask GSTIN anywhere inside address_display
                let wrapper = $("[data-fieldname='address_display']");
                
                wrapper.find("*:contains('GSTIN')").each(function () {
                    let html = $(this).html();

                    // Remove GSTIN number, keep label
                    html = html.replace(/GSTIN:\s*[A-Z0-9]+/i, "GSTIN:");
                    
                    $(this).html(html);
                });
            // Small delay to let HTML fully render
        });
    }
});


// frappe.ui.form.on("Purchase Invoice",{
//     on_submit: function(frm) {
//         if(frm.doc.custom_is_defective){
//             if(!frm.doc.custom_journal_entry){
//                frappe.throw({
//                     title: __("Mandatory"),
//                     message: __("Please Create Journal Entry for Defective Items")
//                 });
//             }
//         }
//     }
// })