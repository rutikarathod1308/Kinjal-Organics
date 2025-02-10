frappe.ui.form.on("Purchase Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    },
    refresh:function(frm){
        frm.add_custom_button(__('Updates Items'), () => {
            erpnext.utils.update_child_items({
                frm: frm,
                child_docname: "items",
                child_doctype: "Purchase Order Detail",
                cannot_add_row: false,
            })
            
            
        });
    }
});
