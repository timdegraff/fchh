
export function renderCollapsible(id, title, content, isOpen, icon = null, colorClass = 'text-white', rightText = '', bgClass = '') {
    const iconHtml = icon ? `<i class="fas ${icon} ${colorClass} w-5 text-center"></i>` : '';
    // Handle bgClass for content (used in budget for different shading)
    const contentBg = bgClass ? bgClass : ''; 
    
    return `
        <div class="collapsible-section">
            <div class="collapsible-header ${isOpen ? 'active' : ''}" onclick="window.toggleSection('${id}')">
                <div class="flex items-center gap-3">
                    ${iconHtml}
                    <span class="font-bold text-white text-base">${title}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-xs font-black ${colorClass} mono-numbers">${rightText}</span>
                    <i class="fas fa-chevron-down text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}"></i>
                </div>
            </div>
            <div class="collapsible-content ${isOpen ? 'open' : ''} ${contentBg}">
                <div class="p-3 space-y-2 sortable-list">
                    ${content}
                </div>
            </div>
        </div>
    `;
}

export function renderStepperSlider(label, path, min, max, step, val, suffix = '', color='text-white') {
    return `
        <div class="mb-5">
            <div class="flex justify-between items-end mb-2">
                <span class="text-[10px] font-bold ${color} uppercase tracking-widest">${label}</span>
                <div class="flex items-center gap-3">
                    <button class="w-6 h-6 flex items-center justify-center bg-slate-800 rounded text-slate-400 hover:text-white" onclick="window.stepConfig('${path}', -${step})"><i class="fas fa-minus text-[8px]"></i></button>
                    <span class="${color} font-black text-sm mono-numbers w-12 text-center">${val}${suffix}</span>
                    <button class="w-6 h-6 flex items-center justify-center bg-slate-800 rounded text-slate-400 hover:text-white" onclick="window.stepConfig('${path}', ${step})"><i class="fas fa-plus text-[8px]"></i></button>
                </div>
            </div>
            <input type="range" data-path="${path}" min="${min}" max="${max}" step="${step}" value="${val}" class="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer">
        </div>
    `;
}
