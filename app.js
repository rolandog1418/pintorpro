/**
 * Lógica de la Aplicación PintorPro
 * Corregida e Integrada
 */

// --- ESTADO GLOBAL ---
const state = {
    currentUser: null, // 'admin', 'guest'
    db: {
        users: [], // {email, pass, companyData...}
        estimates: [], // {id, client, date, total, items...}
        settings: {
            pricePerUnit: 1500, // Precio base defecto
            coverage: 10,       // 10m2 por litro
            theme: {
                bgColor: '#f0f8ff',
                accent: '#4fc3f7',
                secondary: '#0288d1',
                fontSize: 16,
                darkMode: false
            },
            company: {
                name: 'Mi Empresa de Pintura',
                address: '',
                phone: '',
                logo: '',
                email: ''
            }
        }
    },
    currentCalc: {
        area: 0,
        price: 0,
        paint: 0,
        isML: false,
        discountPercent: 0,
        discountAmount: 0
    },
    selectionMode: false,
    selectedIds: [],
    editId: null
};

// --- MÓDULO ALMACENAMIENTO (LocalStorage) ---
const storage = {
    load: () => {
        try {
            const data = localStorage.getItem('pintorProDB');
            if (data) {
                const parsed = JSON.parse(data);
                // Fusionar con cuidado para no borrar estructura si se agregan nuevas props
                state.db = { ...state.db, ...parsed };
                
                // Asegurar que settings y company existan
                if (!state.db.settings) state.db.settings = {};
                if (!state.db.settings.company) state.db.settings.company = {};
            }
            settings.applyTheme();
        } catch (e) {
            console.error("Error cargando datos", e);
        }
    },
    save: () => {
        localStorage.setItem('pintorProDB', JSON.stringify(state.db));
    }
};

// --- MÓDULO PRINCIPAL (AUTH & APP) ---
const app = {
    init: () => {
        storage.load();
        
        // Verificar usuarios existentes
        const adminExists = state.db.users && state.db.users.length > 0;
        
        if (!adminExists) {
            ui.toggleAuthMode('register');
            const btnGuest = document.getElementById('btn-show-register');
            if(btnGuest) btnGuest.style.display = 'none';
        } else {
            ui.toggleAuthMode('login');
            const btnGuest = document.getElementById('btn-show-register');
            if(btnGuest) btnGuest.style.display = 'none';
        }
    },

    login: () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-pass').value;

        // Buscar usuario
        const user = state.db.users.find(u => u.email === email && u.pass === pass);
        
        if (user) {
            state.currentUser = user;
            // Cargar datos de la empresa guardados en el usuario o globales
            nav.goTo('dashboard');
        } else {
            alert('Credenciales incorrectas o usuario no encontrado.');
        }
    },

    guestLogin: () => {
        state.currentUser = { role: 'guest', email: 'invitado@pintorpro.app' };
        nav.goTo('dashboard');
    },

    register: () => {
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-pass').value;

        if (!email || !pass) return alert("Complete todos los campos");

        const newUser = {
            role: 'admin',
            email: email,
            pass: pass,
            joined: new Date()
        };

        if (!state.db.users) state.db.users = [];
        state.db.users.push(newUser);
        
        // Guardar email en settings para referencia
        state.db.settings.company.email = email;
        
        storage.save();
        alert('Registro exitoso. Por favor inicie sesión.');
        ui.toggleAuthMode('login');
    },

    forgotPassword: () => {
        alert("Si olvidaste tu contraseña, deberás reinstalar la aplicación o borrar los datos del navegador para reiniciar como administrador.");
    },

    logout: () => {
        state.currentUser = null;
        nav.goTo('auth'); // Ir a vista de autenticación
        
        // Limpiar campos
        document.getElementById('login-pass').value = '';
    }
};

// --- MÓDULO NAVEGACIÓN ---
const nav = {
    goTo: (viewName) => {
        // Ocultar todas las vistas
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        
        // Resetear navegación inferior
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

        const bottomNav = document.getElementById('bottom-nav');

        // Lógica de Vistas
        if (viewName === 'auth') {
            document.getElementById('view-auth').classList.remove('hidden');
            bottomNav.classList.add('hidden'); // Ocultar nav en login
        } 
        else if (viewName === 'dashboard') {
            document.getElementById('view-dashboard').classList.remove('hidden');
            document.getElementById('nav-dash').classList.add('active');
            bottomNav.classList.remove('hidden');
        } 
        else if (viewName === 'history') {
            document.getElementById('view-history').classList.remove('hidden');
            document.getElementById('nav-hist').classList.add('active');
            bottomNav.classList.remove('hidden');
            hist.render();
        } 
        else if (viewName === 'settings') {
            document.getElementById('view-settings').classList.remove('hidden');
            bottomNav.classList.remove('hidden'); // Opcional
            settings.loadToForm();
        } 
        else if (viewName === 'estimate') {
            document.getElementById('view-estimate-form').classList.remove('hidden');
            bottomNav.classList.add('hidden'); // Ocultar para dar espacio al form
        }
    }
};

// --- MÓDULO CALCULADORA ---
const calc = {
    toggleMode: () => {
        const isML = document.getElementById('toggle-measure').checked;
        state.currentCalc.isML = isML;
        
        document.getElementById('lbl-measure-type').innerText = isML ? "ML" : "M²";
        if(isML) {
            document.getElementById('inputs-m2').classList.add('hidden');
            document.getElementById('inputs-ml').classList.remove('hidden');
        } else {
            document.getElementById('inputs-m2').classList.remove('hidden');
            document.getElementById('inputs-ml').classList.add('hidden');
        }
        calc.calculate();
    },
    calculate: () => {
        let area = 0;
        
        if (state.currentCalc.isML) {
            const w = parseFloat(document.getElementById('inp-width-ml').value) || 0;
            area = w; 
        } else {
            const h = parseFloat(document.getElementById('inp-height').value) || 0;
            const w = parseFloat(document.getElementById('inp-width-m2').value) || 0;
            area = h * w;
        }

        // Cálculo Pintura
        const coverage = state.db.settings.coverage || 10;
        const paintNeeded = area / coverage;

        // Precio Base
        const unitPrice = state.db.settings.pricePerUnit || 0;
        let price = area * unitPrice;

        // Reset variables de descuento
        state.currentCalc.discountPercent = 0;
        state.currentCalc.discountAmount = 0;

        // Descuento
        if (document.getElementById('toggle-discount').checked) {
            document.getElementById('discount-control').classList.remove('hidden');
            const discount = parseFloat(document.getElementById('rng-discount').value) || 0;
            const discountAmount = price * (discount / 100);
            
            state.currentCalc.discountPercent = discount;
            state.currentCalc.discountAmount = discountAmount;
            
            price = price - discountAmount;
        } else {
            document.getElementById('discount-control').classList.add('hidden');
        }

        // Actualizar UI
        document.getElementById('res-area').innerText = area.toFixed(2) + (state.currentCalc.isML ? ' ml' : ' m²');
        document.getElementById('res-paint').innerText = paintNeeded.toFixed(2);
        document.getElementById('res-price').innerText = Math.round(price).toLocaleString();

        // Guardar temp
        state.currentCalc.area = area;
        state.currentCalc.paint = paintNeeded;
        state.currentCalc.price = Math.round(price);
    },
    generateEstimate: () => {
        if(state.currentCalc.price <= 0) return alert("Calcule un valor primero.");
        
        // Reset form
        state.editId = null;
        document.getElementById('est-client').value = "";
        document.getElementById('est-address').value = "";
        document.getElementById('est-phone').value = "";
        document.getElementById('additional-tasks-list').innerHTML = "";
        document.getElementById('btn-save-est').innerText = "Guardar";
        
        nav.goTo('estimate');
        est.updateTotal();
    }
};

// --- MÓDULO PRESUPUESTO ---
const est = {
    addTaskRow: (desc = '', price = '') => {
        const container = document.getElementById('additional-tasks-list');
        const div = document.createElement('div');
        div.className = 'task-item';
        div.style.display = 'flex';
        div.style.gap = '5px';
        div.style.marginBottom = '5px';
        
        div.innerHTML = `
            <input type="text" class="task-desc" placeholder="Descrip." value="${desc}" style="flex:2;">
            <input type="number" class="task-price" placeholder="$" value="${price}" oninput="est.updateTotal()" style="flex:1;">
            <button class="btn-icon btn-danger" style="padding: 5px 10px;" onclick="this.parentElement.remove(); est.updateTotal()">x</button>
        `;
        container.appendChild(div);
    },
    updateTotal: () => {
        const base = state.currentCalc.price; 
        let extras = 0;
        
        document.querySelectorAll('.task-price').forEach(inp => {
            extras += parseFloat(inp.value) || 0;
        });

        const total = base + extras;

        document.getElementById('est-base-price').innerText = '$' + base.toLocaleString();
        document.getElementById('est-extra-price').innerText = '$' + extras.toLocaleString();
        document.getElementById('est-total-final').innerText = '$' + total.toLocaleString();
        
        return total;
    },
    saveEstimate: () => {
        const client = document.getElementById('est-client').value;
        if(!client) return alert('El nombre es obligatorio');

        const total = est.updateTotal(); 
        
        // Recopilar items extras
        const extras = [];
        document.querySelectorAll('.task-item').forEach(row => {
            const desc = row.querySelector('.task-desc').value;
            const price = parseFloat(row.querySelector('.task-price').value) || 0;
            if(desc || price > 0) {
                extras.push({ desc, price });
            }
        });

        const estimateData = {
            id: state.editId || Date.now(),
            date: new Date().toLocaleDateString(),
            client: client,
            address: document.getElementById('est-address').value,
            phone: document.getElementById('est-phone').value,
            baseCalc: JSON.parse(JSON.stringify(state.currentCalc)), // Copia profunda
            extras: extras,
            total: total
        };

        if (!state.db.estimates) state.db.estimates = [];

        if (state.editId) {
            const index = state.db.estimates.findIndex(e => e.id === state.editId);
            if(index !== -1) state.db.estimates[index] = estimateData;
        } else {
            state.db.estimates.unshift(estimateData);
        }
        
        storage.save();
        nav.goTo('history');
    }
};

// --- MÓDULO HISTORIAL ---
const hist = {
    selectedIndexes: [],

    render: () => {
        const container = document.getElementById('history-list');
        if (!container) return;

        container.innerHTML = '';
        hist.selectedIndexes = []; // Reset selección al renderizar

        const budgets = state.db.estimates || [];

        if(budgets.length === 0) {
            container.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top:20px;">No hay historial aún.</p>';
            hist.updateActionBar();
            return;
        }

        budgets.forEach((est, index) => {
            const card = document.createElement('div');
            card.className = 'history-card';
            // Estilos básicos inline por si falta css
            card.style.background = 'rgba(255,255,255,0.7)';
            card.style.padding = '10px';
            card.style.marginBottom = '10px';
            card.style.borderRadius = '8px';
            card.style.border = '1px solid var(--border-color, #ccc)';

            card.innerHTML = `
                <div class="history-main" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <input type="checkbox" class="history-check" data-index="${index}">
                        <div>
                            <strong>${est.client || 'Sin nombre'}</strong><br>
                            <small>${est.date} - $${Number(est.total).toLocaleString()}</small>
                        </div>
                    </div>
                    <button class="pdf-btn btn-icon"><i class="fas fa-file-pdf"></i></button>
                </div>
                <div class="history-details hidden" style="margin-top:10px; font-size:0.9em; border-top:1px solid #eee; padding-top:5px;">
                    <div><b>Superficie:</b> ${est.baseCalc.area.toFixed(2)} ${est.baseCalc.isML ? 'ML' : 'm²'}</div>
                    ${est.extras && est.extras.length ? `<div><b>Extras:</b> ${est.extras.length} items</div>` : ''}
                </div>
            `;

            // Abrir / cerrar detalles
            card.querySelector('.history-main').addEventListener('click', e => {
                // Evitar disparar si click en checkbox o botón
                if (e.target.type !== 'checkbox' && !e.target.closest('.pdf-btn')) {
                    const details = card.querySelector('.history-details');
                    details.classList.toggle('hidden');
                }
            });

            // Botón PDF
            const pdfBtn = card.querySelector('.pdf-btn');
            pdfBtn.addEventListener('click', e => {
                e.stopPropagation();
                hist.printPDF(index);
            });

            // Checkbox Selección
            const checkbox = card.querySelector('.history-check');
            checkbox.addEventListener('change', e => {
                const i = Number(e.target.dataset.index);
                if (e.target.checked) {
                    if (!hist.selectedIndexes.includes(i)) hist.selectedIndexes.push(i);
                } else {
                    hist.selectedIndexes = hist.selectedIndexes.filter(x => x !== i);
                }
                hist.updateActionBar();
            });

            container.appendChild(card);
        });

        hist.updateActionBar();
    },

    printPDF: (index) => {
        if(!window.jspdf) {
            alert("Librería PDF cargando... intente de nuevo en unos segundos.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const item = state.db.estimates[index];
        if (!item) return;

        const company = state.db.settings.company || {};
        const left = 15;
        let y = 20;

        // --- ENCABEZADO ---
        if (company.logo) {
            try {
                // AddImage requiere base64 limpio
                doc.addImage(company.logo, 'PNG', left, y, 25, 25);
            } catch (e) {
                console.warn("Error agregando logo", e);
            }
        }

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(company.name || 'Presupuesto', left + 35, y + 8);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (company.phone) doc.text(`Tel: ${company.phone}`, left + 35, y + 16);
        if (company.address) doc.text(company.address, left + 35, y + 22);
        if (company.email) doc.text(company.email, left + 35, y + 28);

        y += 40;
        doc.setLineWidth(0.5);
        doc.line(left, y, 195, y);
        y += 10;

        // --- DATOS CLIENTE ---
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(`Cliente: ${item.client}`, left, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Fecha: ${item.date}`, 150, y);
        y += 6;
        if(item.address) {
             doc.text(`Dirección: ${item.address}`, left, y);
             y += 6;
        }

        y += 10;

        // --- TABLA DETALLES ---
        doc.setFillColor(240, 240, 240);
        doc.rect(left, y-5, 180, 8, 'F');
        doc.setFont("helvetica", "bold");
        doc.text("Descripción", left + 2, y);
        doc.text("Importe", 170, y);
        y += 10;

        // Item Principal
        doc.setFont("helvetica", "normal");
        const unit = item.baseCalc.isML ? 'ML' : 'm²';
        const desc = `Pintura en sup. (${item.baseCalc.area} ${unit})`;

        doc.text(desc, left + 2, y);
        doc.text(`$${item.baseCalc.price.toLocaleString()}`, 170, y);
        y += 8;

        // Descuento
        if (item.baseCalc.discountAmount > 0) {
            doc.setTextColor(200, 0, 0);
            doc.text(`Descuento (${item.baseCalc.discountPercent}%)`, left + 5, y);
            doc.text(`-$${item.baseCalc.discountAmount.toLocaleString()}`, 170, y);
            doc.setTextColor(0);
            y += 8;
        }

        // Extras
        if (item.extras && item.extras.length > 0) {
            y += 5;
            doc.setFont("helvetica", "bold");
            doc.text("Adicionales:", left + 2, y);
            y += 6;
            doc.setFont("helvetica", "normal");
            
            item.extras.forEach(ex => {
                doc.text(`- ${ex.desc}`, left + 5, y);
                doc.text(`$${ex.price.toLocaleString()}`, 170, y);
                y += 6;
            });
        }

        // --- TOTAL ---
        y += 5;
        doc.setLineWidth(0.5);
        doc.line(130, y, 195, y);
        y += 10;

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 130, y);
        doc.text(`$${item.total.toLocaleString()}`, 170, y);
        
        y += 20;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Presupuesto válido por 15 días.", left, y);

        // Guardar
        const cleanName = item.client.replace(/[^a-z0-9]/gi, '_');
        doc.save(`Presupuesto_${cleanName}.pdf`);
    },

    deleteSelected: () => {
        if (!hist.selectedIndexes.length) return;
        if (!confirm(`¿Eliminar ${hist.selectedIndexes.length} presupuesto(s)?`)) return;

        // Filtrar manteniendo los que NO están en el array de índices seleccionados
        state.db.estimates = state.db.estimates.filter((_, i) => !hist.selectedIndexes.includes(i));
        
        storage.save();
        hist.render();
    },

    selectAll: () => {
        const checkboxes = document.querySelectorAll('.history-check');
        hist.selectedIndexes = [];
        checkboxes.forEach(ch => {
            ch.checked = true;
            hist.selectedIndexes.push(Number(ch.dataset.index));
        });
        hist.updateActionBar();
    },

    cancelSelection: () => {
        hist.selectedIndexes = [];
        document.querySelectorAll('.history-check').forEach(ch => ch.checked = false);
        hist.updateActionBar();
    },

    updateActionBar: () => {
        let bar = document.getElementById('history-actions');
        if (bar) {
            bar.style.display = hist.selectedIndexes.length > 0 ? 'flex' : 'none';
        }
    }
};

// --- MÓDULO CONFIGURACIÓN ---
const settings = {
    loadToForm: () => {
        const s = state.db.settings;
        document.getElementById('set-company').value = s.company.name || '';
        document.getElementById('set-email').value = s.company.email || '';
        document.getElementById('set-address').value = s.company.address || '';
        document.getElementById('set-phone').value = s.company.phone || '';
        
        // Colores
        document.getElementById('set-bg-color').value = s.theme.bgColor || '#f0f8ff';
        document.getElementById('set-color-accent').value = s.theme.accent || '#4fc3f7';
        document.getElementById('set-secondary-color').value = s.theme.secondary || '#0288d1';
        
        document.getElementById('font-size-display').innerText = (s.theme.fontSize || 16) + 'px';
        document.getElementById('set-darkmode').checked = s.theme.darkMode;
        
        document.getElementById('set-price').value = s.pricePerUnit;
        document.getElementById('set-coverage').value = s.coverage;
    },
    
    saveAll: () => {
        const s = state.db.settings;
        s.company.name = document.getElementById('set-company').value;
        s.company.address = document.getElementById('set-address').value;
        s.company.phone = document.getElementById('set-phone').value;
        
        // Guardar colores
        s.theme.bgColor = document.getElementById('set-bg-color').value;
        s.theme.accent = document.getElementById('set-color-accent').value;
        s.theme.secondary = document.getElementById('set-secondary-color').value;
        
        s.theme.darkMode = document.getElementById('set-darkmode').checked;
        s.theme.fontSize = parseInt(document.getElementById('font-size-display').innerText);
        
        // Password
        const newPass = document.getElementById('set-password').value;
        if(newPass && state.currentUser && state.currentUser.role === 'admin') {
            state.currentUser.pass = newPass;
            const idx = state.db.users.findIndex(u => u.email === state.currentUser.email);
            if(idx !== -1) state.db.users[idx].pass = newPass;
            alert('Contraseña actualizada');
            document.getElementById('set-password').value = '';
        }

        s.pricePerUnit = parseFloat(document.getElementById('set-price').value) || s.pricePerUnit;
        s.coverage = parseFloat(document.getElementById('set-coverage').value) || s.coverage;

        storage.save();
        settings.applyTheme();
        alert('Configuración Guardada');
        nav.goTo('dashboard');
    },
    
    handleLogoUpload: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                // Comprimir o limitar tamaño sería ideal, pero guardamos directo
                state.db.settings.company.logo = e.target.result; 
                document.getElementById('header-logo').src = e.target.result;
            }
            reader.readAsDataURL(input.files[0]);
        }
    },
    
    adjustFont: (delta) => {
        let current = state.db.settings.theme.fontSize || 16;
        let newSize = current + delta;
        if(newSize < 12) newSize = 12;
        if(newSize > 24) newSize = 24;
        
        state.db.settings.theme.fontSize = newSize;
        document.getElementById('font-size-display').innerText = newSize + 'px';
        document.documentElement.style.setProperty('--base-font-size', newSize + 'px');
    },
    
    toggleDarkMode: () => {
        // Previsualización inmediata
        const isDark = document.getElementById('set-darkmode').checked;
        if(isDark) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
    },
    
    updatePreview: () => {
        const bgColor = document.getElementById('set-bg-color').value;
        const pastelColor = settings.hexToPastel(bgColor);
        document.documentElement.style.setProperty('--primary-bg', pastelColor);

        const accentColor = document.getElementById('set-color-accent').value;
        document.documentElement.style.setProperty('--accent-color', accentColor);

        const secondaryColor = document.getElementById('set-secondary-color').value;
        document.documentElement.style.setProperty('--secondary-accent', secondaryColor);
        document.documentElement.style.setProperty('--border-color', settings.lightenColor(secondaryColor, 40));
    },
    
    hexToPastel: (hex) => {
        if(!hex || hex.length < 7) return hex;
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        // Mezclar con blanco para hacer pastel
        r = Math.min(255, Math.floor(r + (255 - r) * 0.7));
        g = Math.min(255, Math.floor(g + (255 - g) * 0.7));
        b = Math.min(255, Math.floor(b + (255 - b) * 0.7));

        return `rgb(${r}, ${g}, ${b})`;
    },
    
    lightenColor: (hex, percent) => {
        if(!hex || hex.length < 7) return hex;
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        r = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
        g = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
        b = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

        return `rgb(${r}, ${g}, ${b})`;
    },
    
    applyTheme: () => {
        const s = state.db.settings.theme;
        
        const pastelBg = settings.hexToPastel(s.bgColor || '#f0f8ff');
        document.documentElement.style.setProperty('--primary-bg', pastelBg);
        
        document.documentElement.style.setProperty('--accent-color', s.accent);
        document.documentElement.style.setProperty('--secondary-accent', s.secondary);
        document.documentElement.style.setProperty('--base-font-size', (s.fontSize || 16) + 'px');
        
        const lightBorder = settings.lightenColor(s.secondary, 40);
        document.documentElement.style.setProperty('--border-color', lightBorder);
        
        if(s.darkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');
        
        document.getElementById('header-company-name').innerText = state.db.settings.company.name || 'Mi Empresa';
        if(state.db.settings.company.logo) {
            document.getElementById('header-logo').src = state.db.settings.company.logo;
        }
    }
};

// --- UI HELPERS ---
const ui = {
    toggleAuthMode: (mode) => {
        if(mode === 'register') {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.remove('hidden');
        } else {
            document.getElementById('login-form').classList.remove('hidden');
            document.getElementById('register-form').classList.add('hidden');
        }
    }
};

// --- INICIALIZACIÓN ---
window.onload = function() {
    app.init();
};
