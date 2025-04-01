frappe.ui.form.on("Purchase Order", {
    before_save: function (frm) {
        frm.doc.items.forEach(item => {
            frappe.model.set_value(item.doctype, item.name, "custom_pending_qty", item.qty);
        });
    },
})


