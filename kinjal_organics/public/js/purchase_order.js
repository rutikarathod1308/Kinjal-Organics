frappe.ui.form.on("Purchase Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    },
    // refresh:function(frm){
    //     frm.add_custom_button(__('Custom Update Items'), () => {
    //         erpnext.utils.update_child_items({
    //             frm: frm,
    //             child_docname: "items",
    //             child_doctype: "Purchase Order Detail",
    //             cannot_add_row: false,
    //         })
            
            
    //     });
    // }
    
});
// frappe.ui.form.on('Purchase Order', {
//     refresh: function (frm) {
        
//         frm.add_custom_button(__('Custom Update Items'), () => {
			
//             update_child_items({
//                 frm: frm,
//                 child_docname: "items",
//                 child_doctype: "Purchase Order Details",
//                 cannot_add_row: false,
//             })
//         });
//     }
// });

// function update_child_items(opts) {
//     const frm = opts.frm;
//     const cannot_add_row = (typeof opts.cannot_add_row === 'undefined') ? true : opts.cannot_add_row;
//     const child_docname = (typeof opts.child_docname === 'undefined') ? "items" : opts.child_docname;
//     const child_meta = frappe.get_meta(`${frm.doc.doctype} Item`);
//     const get_precision = (fieldname) => child_meta.fields.find(f => f.fieldname == fieldname).precision;

//     // Initialize data array at the beginning
//     let dialog_data = [];

//     const fields = [{
//         fieldtype: 'Data',
//         fieldname: "docname",
//         read_only: 1,
//         hidden: 1,
//     }, {
//         fieldtype: 'Link',
//         fieldname: "item_code",
//         options: 'Item',
//         in_list_view: 1,
//         read_only: 0,
//         disabled: 0,
//         label: __('Item Code'),
//         get_query: function() {
//             let filters;
//             if (frm.doc.doctype == 'Sales Order') {
//                 filters = {"is_sales_item": 1};
//             } else if (frm.doc.doctype == 'Purchase Order') {
//                 if (frm.doc.is_subcontracted == "Yes") {
//                     filters = {"is_sub_contracted_item": 1};
//                 } else {
//                     filters = {"is_purchase_item": 1};
//                 }
//             }
//             return {
//                 query: "erpnext.controllers.queries.item_query",
//                 filters: filters
//             };
//         }
//     }, {
//         fieldtype: 'Link',
//         fieldname: 'uom',
//         options: 'UOM',
//         read_only: 0,
//         label: __('UOM'),
//         reqd: 1,
//         onchange: function () {
//             frappe.call({
//                 method: "erpnext.stock.get_item_details.get_conversion_factor",
//                 args: { item_code: this.doc.item_code, uom: this.value },
//                 callback: r => {
//                     if(!r.exc) {
//                         if (this.doc.conversion_factor == r.message.conversion_factor) return;

//                         const docname = this.doc.docname;
//                         dialog.fields_dict.trans_items.df.data.some(doc => {
//                             if (doc.docname == docname) {
//                                 doc.conversion_factor = r.message.conversion_factor;
//                                 dialog.fields_dict.trans_items.grid.refresh();
//                                 return true;
//                             }
//                         })
//                     }
//                 }
//             });
//         }
//     }, {
//         fieldtype: 'Float',
//         fieldname: "qty",
//         default: 0,
//         read_only: 0,
//         in_list_view: 1,
//         label: __('Qty'),
//         precision: get_precision("qty")
//     }, {
//         fieldtype: 'Currency',
//         fieldname: "rate",
//         options: "currency",
//         default: 0,
//         read_only: 0,
//         in_list_view: 1,
//         label: __('Rate'),
//         precision: get_precision("rate")
//     }];

//     if (frm.doc.doctype == 'Sales Order' || frm.doc.doctype == 'Purchase Order' ) {
//         fields.splice(2, 0, {
//             fieldtype: 'Date',
//             fieldname: frm.doc.doctype == 'Sales Order' ? "delivery_date" : "schedule_date",
//             in_list_view: 1,
//             label: frm.doc.doctype == 'Sales Order' ? __("Delivery Date") : __("Reqd by date"),
//             reqd: 1
//         })
//         fields.splice(3, 0, {
//             fieldtype: 'Float',
//             fieldname: "conversion_factor",
//             in_list_view: 1,
//             label: __("Conversion Factor"),
//             precision: get_precision('conversion_factor')
//         })
//     }

//     const dialog = new frappe.ui.Dialog({
//         title: __("Update Items"),
//         fields: [
//             {
//                 fieldname: "trans_items",
//                 fieldtype: "Table",
//                 label: "Items",
//                 cannot_add_rows: cannot_add_row,
//                 in_place_edit: false,
//                 reqd: 1,
//                 data: dialog_data,
//                 get_data: () => {
//                     return dialog_data;
//                 },
//                 fields: fields
//             },
//         ],
//         primary_action: function() {
			
//             const trans_items = this.get_values()["trans_items"].filter((item) => !!item.item_code);
//             frappe.call({
//                 method: 'erpnext.controllers.accounts_controller.update_child_qty_rate',
//                 freeze: true,
//                 args: {
//                     'parent_doctype': frm.doc.doctype,
//                     'trans_items': trans_items,
//                     'parent_doctype_name': frm.doc.name,
//                     'child_docname': child_docname
//                 },
//                 callback: function() {
					
// 						frappe.db.set_value('Purchase Order',frm.doc.name,'workflow_state','Re-Approve').then(()=>{
// 						frm.reload_doc();
// 					})
					
// 				}
//             });
//             this.hide();
//             refresh_field("items");
			
//         },
//         primary_action_label: __('Update')
//     });

//     // Populate dialog_data with existing items
//     frm.doc[opts.child_docname].forEach(d => {
//         dialog_data.push({
//             "docname": d.name,
//             "name": d.name,
//             "item_code": d.item_code,
//             "delivery_date": d.delivery_date,
//             "schedule_date": d.schedule_date,
//             "conversion_factor": d.conversion_factor,
//             "qty": d.qty,
//             "rate": d.rate,
//             "uom": d.uom
//         });
//     });

	

//     // Refresh the grid after populating data
//     dialog.fields_dict.trans_items.grid.refresh();
//     dialog.show();
// }
