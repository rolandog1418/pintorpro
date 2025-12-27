
        /**
         * Lógica de la Aplicación PintorPro
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
                        logo: '' // base64 string
                    }
                }
            },
            currentCalc: {
                area: 0,
                price: 0,
                paint: 0,
                isML: false
            },
            selectionMode: false,
            selectedIds: [],
            editId: null
        };

        // --- INICIALIZACIÓN ---
        window.onload = function() {
            storage.load();
            
            // Verificar si hay admin registrado, si no, mostrar opción registro
            const adminExists = state.db.users.find(u => u.role === 'admin');
            if (!adminExists) {
                ui.toggleAuthMode('register');
                document.getElementById('btn-show-register').style.display = 'none';
            } else {
                ui.toggleAuthMode('login');
                document.getElementById('btn-show-register').style.display = 'none'; // Solo un admin por app local
            }
        };

        // --- MÓDULO ALMACENAMIENTO (LocalStorage) ---
        const storage = {
            load: () => {
                const data = localStorage.getItem('pintorProDB');
                if (data) {
                    const parsed = JSON.parse(data);
                    state.db = { ...state.db, ...parsed }; // Merge
                }
                settings.applyTheme();
            },
            save: () => {
                localStorage.setItem('pintorProDB', JSON.stringify(state.db));
            }
        };



        // --- MÓDULO NAVEGACIÓN ---
        const nav = {
            goTo: (viewName) => {
                // Ocultar todas las vistas
                document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
                
                // Resetear navegación inferior
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

                // Mostrar target
                if(viewName === 'dashboard') {
                    document.getElementById('view-dashboard').classList.remove('hidden');
                    document.getElementById('nav-dash').classList.add('active');
                } else if (viewName === 'history') {
                    document.getElementById('view-history').classList.remove('hidden');
                    document.getElementById('nav-hist').classList.add('active');
                    hist.render();
                } else if (viewName === 'settings') {
                    document.getElementById('view-settings').classList.remove('hidden');
                    settings.loadToForm();
                } else if (viewName === 'estimate') {
                    document.getElementById('view-estimate-form').classList.remove('hidden');
                }
                
                // Salir modo selección si cambia vista
                //hist.clearSelection();
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
                    area = w; // En ML el "área" es la longitud para el cálculo de precio
                } else {
                    const h = parseFloat(document.getElementById('inp-height').value) || 0;
                    const w = parseFloat(document.getElementById('inp-width-m2').value) || 0;
                    area = h * w;
                }

                // Cálculo Pintura
                // Si es ML, el rendimiento de pintura es relativo, usaremos un factor estimado o el mismo si es zócalo
                // Para simplificar, asumimos rendimiento M2 estandar.
                const paintNeeded = area / state.db.settings.coverage;

                // Precio Base
                let price = area * state.db.settings.pricePerUnit;

                // Descuento
                if (document.getElementById('toggle-discount').checked) {
                    document.getElementById('discount-control').classList.remove('hidden');
                    const discount = parseFloat(document.getElementById('rng-discount').value) || 0;
                    price = price - (price * (discount / 100));
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
                div.innerHTML = `
                    <input type="text" class="task-desc" placeholder="Descrip." value="${desc}">
                    <input type="number" class="task-price" placeholder="$" value="${price}" oninput="est.updateTotal()">
                    <button class="btn-icon btn-danger" style="padding: 5px 10px;" onclick="this.parentElement.remove(); est.updateTotal()">x</button>
                `;
                container.appendChild(div);
            },
            updateTotal: () => {
                const base = state.currentCalc.price; // Precio del cálculo principal (mano de obra base)
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

                const total = est.updateTotal(); // Recalcular seguro
                
                // Recopilar items extras
                const extras = [];
                document.querySelectorAll('.task-item').forEach(row => {
                    extras.push({
                        desc: row.querySelector('.task-desc').value,
                        price: parseFloat(row.querySelector('.task-price').value) || 0
                    });
                });

                const estimateData = {
                    id: state.editId || Date.now(),
                    date: new Date().toLocaleDateString(),
                    client: client,
                    address: document.getElementById('est-address').value,
                    phone: document.getElementById('est-phone').value,
                    baseCalc: { ...state.currentCalc }, // Copia de lo calculado
                    extras: extras,
                    total: total
                };

                if (state.editId) {
                    // Actualizar existente
                    const index = state.db.estimates.findIndex(e => e.id === state.editId);
                    if(index !== -1) state.db.estimates[index] = estimateData;
                } else {
                    // Nuevo
                    state.db.estimates.unshift(estimateData); // Agregar al principio
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

        const data = JSON.parse(localStorage.getItem('pintorProDB')) || {};
        const budgets = data.estimates || [];

        budgets.forEach((est, index) => {
            const card = document.createElement('div');
            card.className = 'history-card';

            card.innerHTML = `
                <div class="history-main">
                    <input type="checkbox" class="history-check" data-index="${index}">
                    <strong>${est.client || 'Sin nombre'}</strong>
                    <span>${est.date}</span>
                    <span>$${Number(est.total).toLocaleString()}</span>
                    <button class="pdf-btn">📄</button>
                </div>

                <div class="history-details">
                    <div><b>Superficie:</b> ${est.baseCalc.area} ${est.baseCalc.isML ? 'ML' : 'm²'}</div>
                </div>
            `;

            // Abrir / cerrar
            card.querySelector('.history-main').addEventListener('click', e => {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
                    card.classList.toggle('open');
                }
            });

            // PDF
            card.querySelector('.pdf-btn').addEventListener('click', e => {
                e.stopPropagation();
                hist.printPDF(index);
            });

            // Selección
            const checkbox = card.querySelector('.history-check');
            checkbox.addEventListener('change', e => {
                const i = Number(e.target.dataset.index);
                if (e.target.checked) {
                    if (!hist.selectedIndexes.includes(i)) {
                        hist.selectedIndexes.push(i);
                    }
                } else {
                    hist.selectedIndexes = hist.selectedIndexes.filter(x => x !== i);
                }
                hist.updateActionBar();
            });

            container.appendChild(card);
        });

        hist.updateActionBar();
    },

    // ===== PDF ROBUSTO =====
    printPDF: (index) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const data = JSON.parse(localStorage.getItem('pintorProDB')) || {};
        const item = data.estimates[index];
        if (!item) return;

        const company = data.settings?.company || {};
        const left = 15;
        let y = 20;

        // Empresa
        if (company.logo) {
            try {
                doc.addImage(company.logo, 'PNG', left, y, 30, 30);
            } catch {}
        }

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(company.name || '', left + 35, y + 10);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (company.phone) doc.text(`Tel: ${company.phone}`, left + 35, y + 17);
        if (company.address) doc.text(company.address, left + 35, y + 24);

        y += 40;
        doc.line(left, y, 195, y);
        y += 15;

        // Cliente
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Presupuesto para: ${item.client || '—'}`, left, y);
        y += 10;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Fecha: ${item.date}`, left, y);
        y += 14;

        // Encabezado tabla
        doc.setFont("helvetica", "bold");
        doc.text("Descripción", left, y);
        doc.text("Total", 170, y);
        y += 8;

        // Trabajo principal
        doc.setFont("helvetica", "normal");
        const desc = item.baseCalc.isML
            ? `Trabajo de pintura (${item.baseCalc.area} ML)`
            : `Trabajo de pintura (${item.baseCalc.area} m²)`;

        doc.text(desc, left, y);
        doc.text(`$${item.baseCalc.price.toLocaleString()}`, 170, y);
        y += 8;

        // Descuento
        if (item.baseCalc.discountPercent && item.baseCalc.discountAmount) {
            doc.setTextColor(120);
            doc.text(
                `Descuento aplicado (${item.baseCalc.discountPercent}%)`,
                left,
                y
            );
            doc.text(
                `-$${item.baseCalc.discountAmount.toLocaleString()}`,
                170,
                y
            );
            doc.setTextColor(0);
            y += 8;
        }

        // Adicionales
        if (item.extras?.length) {
            y += 4;
            doc.setFont("helvetica", "bold");
            doc.text("Trabajos adicionales:", left, y);
            y += 8;

            doc.setFont("helvetica", "normal");
            item.extras.forEach(extra => {
                if (!extra.desc) return;
                doc.text(`- ${extra.desc}`, left + 2, y);
                doc.text(`$${extra.price.toLocaleString()}`, 170, y);
                y += 7;
            });
        }

        // Total
        y += 6;
        doc.line(140, y, 195, y);
        y += 10;

        doc.setFont("helvetica", "bold");
        doc.text("TOTAL:", 140, y);
        doc.text(`$${item.total.toLocaleString()}`, 170, y);
        y += 16;

        // Garantía
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("Garantía: 6 meses sobre los trabajos realizados.", left, y);
        doc.setTextColor(0);

        doc.save(`Presupuesto_${item.date}.pdf`);
    },

    deleteSelected: () => {
        if (!hist.selectedIndexes.length) return;
        if (!confirm('¿Eliminar los presupuestos seleccionados?')) return;

        const data = JSON.parse(localStorage.getItem('pintorProDB')) || {};
        data.estimates = (data.estimates || []).filter(
            (_, i) => !hist.selectedIndexes.includes(i)
        );

        localStorage.setItem('pintorProDB', JSON.stringify(data));
        hist.selectedIndexes = [];
        hist.render();
    },

    selectAll: () => {
        hist.selectedIndexes = [];
        document.querySelectorAll('.history-check').forEach(ch => {
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

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'history-actions';
            bar.innerHTML = `
                <button onclick="hist.selectAll()">Seleccionar todo</button>
                <button onclick="hist.deleteSelected()">Eliminar</button>
                <button onclick="hist.cancelSelection()">Cancelar</button>
            `;
            document.body.appendChild(bar);
        }

        bar.style.display = hist.selectedIndexes.length ? 'flex' : 'none';
    }
};
                    
    
        // --- MÓDULO CONFIGURACIÓN ---
        const settings = {
            loadToForm: () => {
                const s = state.db.settings;
                document.getElementById('set-company').value = s.company.name;
                document.getElementById('set-email').value = s.company.email || '';
                document.getElementById('set-address').value = s.company.address;
                document.getElementById('set-phone').value = s.company.phone;
                
                // Cargar colores del tema
                document.getElementById('set-bg-color').value = s.theme.bgColor || '#f0f8ff';
                document.getElementById('set-color-accent').value = s.theme.accent || '#4fc3f7';
                document.getElementById('set-secondary-color').value = s.theme.secondary || '#0288d1';
                
                document.getElementById('font-size-display').innerText = s.theme.fontSize + 'px';
                document.getElementById('set-darkmode').checked = s.theme.darkMode;
                
                document.getElementById('set-price').value = s.pricePerUnit;
                document.getElementById('set-coverage').value = s.coverage;
            },
            
            saveAll: () => {
                const s = state.db.settings;
                s.company.name = document.getElementById('set-company').value;
                s.company.address = document.getElementById('set-address').value;
                s.company.phone = document.getElementById('set-phone').value;
                
                // Guardar colores del tema
                s.theme.bgColor = document.getElementById('set-bg-color').value;
                s.theme.accent = document.getElementById('set-color-accent').value;
                s.theme.secondary = document.getElementById('set-secondary-color').value;
                
                s.theme.darkMode = document.getElementById('set-darkmode').checked;
                s.theme.fontSize = parseInt(document.getElementById('font-size-display').innerText);
                
                // Password
                const newPass = document.getElementById('set-password').value;
                if(newPass && state.currentUser.role === 'admin') {
                    state.currentUser.pass = newPass;
                    // Actualizar en array users
                    const idx = state.db.users.findIndex(u => u.email === state.currentUser.email);
                    if(idx !== -1) state.db.users[idx].pass = newPass;
                    document.getElementById('set-password').value = '';
                    alert('Contraseña actualizada');
                }

                s.pricePerUnit = parseFloat(document.getElementById('set-price').value) || s.pricePerUnit;
                s.coverage = parseFloat(document.getElementById('set-coverage').value) || s.coverage;

                storage.save();
                settings.applyTheme();
                alert('Configuración Guardada');
            },
            
            handleLogoUpload: (input) => {
                if (input.files && input.files[0]) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        state.db.settings.company.logo = e.target.result; // Base64
                        document.getElementById('header-logo').src = e.target.result;
                    }
                    reader.readAsDataURL(input.files[0]);
                }
            },
            
            adjustFont: (delta) => {
                let newSize = state.db.settings.theme.fontSize + delta;
                if(newSize < 12) newSize = 12;
                if(newSize > 24) newSize = 24;
                
                state.db.settings.theme.fontSize = newSize;
                document.getElementById('font-size-display').innerText = newSize + 'px';
                document.documentElement.style.setProperty('--base-font-size', newSize + 'px');
            },
            
            toggleDarkMode: () => {
                // Solo previsualización, se guarda con botón
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
                document.documentElement.style.setProperty('--border-color',
                    settings.lightenColor(secondaryColor, 40));
            },
            
            hexToPastel: (hex) => {
                let r = parseInt(hex.slice(1, 3), 16);
                let g = parseInt(hex.slice(3, 5), 16);
                let b = parseInt(hex.slice(5, 7), 16);

                r = Math.min(255, Math.floor(r + (255 - r) * 0.7));
                g = Math.min(255, Math.floor(g + (255 - g) * 0.7));
                b = Math.min(255, Math.floor(b + (255 - b) * 0.7));

                return `rgb(${r}, ${g}, ${b})`;
            },
            
            lightenColor: (hex, percent) => {
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
                
                // Aplicar color de fondo en versión pastel
                const pastelBg = settings.hexToPastel(s.bgColor || '#f0f8ff');
                document.documentElement.style.setProperty('--primary-bg', pastelBg);
                
                document.documentElement.style.setProperty('--accent-color', s.accent);
                document.documentElement.style.setProperty('--secondary-accent', s.secondary);
                document.documentElement.style.setProperty('--base-font-size', s.fontSize + 'px');
                
                // Aplicar color de borde más claro
                const lightBorder = settings.lightenColor(s.secondary, 40);
                document.documentElement.style.setProperty('--border-color', lightBorder);
                
                if(s.darkMode) document.body.classList.add('dark-mode');
                else document.body.classList.remove('dark-mode');
                
                // Actualizar header
                document.getElementById('header-company-name').innerText = state.db.settings.company.name;
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
