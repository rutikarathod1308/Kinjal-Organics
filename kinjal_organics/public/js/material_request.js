frappe.ui.form.on("Material Request",{
    refresh:function(frm){
        if (frm.doc.material_request_type === "Manufacture" && frm.doc.status === "Pending") {
            frm.add_custom_button(__("Production Plan"),
                () => frm.events.production_raised(frm), __('Create'));
        }

        frm.page.set_inner_btn_group_as_primary(__('Create'));
    },
    production_raised: function(frm) {
		frappe.call({
			method:"kinjal_organics.public.py.material_request.raise_production_plan",
			args: {
				"material_request": frm.doc.name
			},
			freeze: true,
			callback: function(r) {
				if(r.message.length) {
					frm.reload_doc();
				}
			}
		});
	},
})
frappe.ui.form.on('Material Request', {
    refresh(frm) {
        setTimeout(() => {
            
            frm.remove_custom_button('Work Order', 'Create');
           
        }, 10);
    }
});