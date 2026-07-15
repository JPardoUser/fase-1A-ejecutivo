/* ========================================
   EFECTIVA - TU FINANCIERA
   Módulo Ejecutivo v2 - JavaScript
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
    // ============================
    // DOM REFERENCES
    // ============================
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const headerUser = document.getElementById('headerUser');
    const userDropdown = document.getElementById('userDropdown');
    const headerLocationText = document.getElementById('headerLocationText');
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    const modulePages = document.querySelectorAll('.module-page');

    // Simulación
    const formSimulacion = document.getElementById('formSimulacion');
    const tipoDocumento = document.getElementById('tipoDocumento');
    const nroDocumento = document.getElementById('nroDocumento');
    const nroTelefono = document.getElementById('nroTelefono');
    const simPrecioVehiculoUsd = document.getElementById('simPrecioVehiculoUsd');
    const simConcesionario = document.getElementById('simConcesionario');
    const simSucursal = document.getElementById('simSucursal');
    const calcTelefonoPoliticas = document.getElementById('calcTelefonoPoliticas');
    const toggleConyuge = document.getElementById('toggleConyuge');
    const conyugeData = document.getElementById('conyugeData');
    const labelNo = document.getElementById('labelNo');
    const labelSi = document.getElementById('labelSi');
    const btnSimular = document.getElementById('btnSimular');
    const btnLimpiar = document.getElementById('btnLimpiar');

    // Bandeja Redesigned
    const searchSolId = document.getElementById('searchSolId');
    const searchDocNum = document.getElementById('searchDocNum');
    const searchNombres = document.getElementById('searchNombres');
    const searchSucursal = document.getElementById('searchSucursal');
    const searchEtapa = document.getElementById('searchEtapa');
    const searchEstado = document.getElementById('searchEstado');
    const searchFechaDesde = document.getElementById('searchFechaDesde');
    const searchFechaHasta = document.getElementById('searchFechaHasta');
    const btnLimpiarBandeja = document.getElementById('btnLimpiarBandeja');
    const tablaBandejaNewBody = document.getElementById('tablaBandejaNewBody');
    const btnBandejaMenu = document.getElementById('btnBandejaMenu');

    // Modal
    const modalOverlay = document.getElementById('modalOverlay');
    const modalClose = document.getElementById('modalClose');
    const modalBtnCancel = document.getElementById('modalBtnCancel');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    // Toast
    const toastContainer = document.getElementById('toastContainer');

    // Global active solicitation state
    let currentSolicitudId = null;
    let correlativoCounter = 1;
    let isSolicitudReadOnly = false;
    let currentCarretera = 'EXPRESS';
    let simulacionConfirmCancelHandler = null;
    let simulacionStageChangeCancelHandler = null;
    let pendingStageSimulacionChange = null;
    let stageNavigationEnabledForCurrentFlow = false;
    let stageSimulacionChangeGuardSolicitudId = null;
    let stageSimulacionChangeGuardBaseline = new WeakMap();
    let suspendStageSimulacionChangeGuard = false;
    let resultadoActionsLockedByStage = false;


    // ============================
    // NAVIGATION TABS — ETAPAS DE SOLICITUD
    // ============================
    const ETAPAS_SOLICITUD_NAV = [
        { key: 'SIMULACION', order: '01', label: 'SIMULACIÓN' },
        { key: 'SOLICITUD', order: '02', label: 'SOLICITUD' }
    ];

    function getEtapaNavigationKey(etapa) {
        const etapaNormalizada = normalizarEtapa(etapa || 'SIMULACIÓN');
        if (etapaNormalizada === 'SIMULACION') return 'SIMULACION';
        if (etapaNormalizada === 'SOLICITUD' || etapaNormalizada === 'RIESGOS') return 'SOLICITUD';
        if (['DOCUMENTARIA', 'FIRMA', 'FIRMAS', 'OPERACIONES', 'ACTIVACION', 'ACTIVADO'].includes(etapaNormalizada)) {
            return 'SOLICITUD';
        }
        return etapaNormalizada;
    }

    function getStageStatusClass(status) {
        return String(status || 'PENDIENTE')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');
    }

    function isResultadoNavigationAllowedForSolicitud(solicitud) {
        if (!solicitud) return false;
        const etapa = normalizarEtapa(solicitud.etapa);
        const estado = normalizarEtapa(solicitud.estado || 'PENDIENTE');

        if (etapa === 'RIESGOS') return ['PENDIENTE', 'OBSERVADO', 'RECHAZADO'].includes(estado);
        if (etapa === 'DOCUMENTARIA') return estado === 'PENDIENTE';
        if (etapa === 'OPERACIONES') return ['PENDIENTE', 'OBSERVADO', 'RECHAZADO', 'APROBADO'].includes(estado);
        return solicitud.habilitarNavegacionEtapas === true;
    }

    function canUseStageNavigationForCurrentFlow() {
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
        return !!(stageNavigationEnabledForCurrentFlow && isResultadoNavigationAllowedForSolicitud(solicitudActual));
    }

    function shouldDisableResultadoActions(solicitud) {
        if (!solicitud) return false;
        const etapa = normalizarEtapa(solicitud.etapa);
        const estado = normalizarEtapa(solicitud.estado || 'PENDIENTE');

        if (etapa === 'RIESGOS') return ['PENDIENTE', 'RECHAZADO'].includes(estado);
        if (etapa === 'DOCUMENTARIA') return estado === 'PENDIENTE';
        if (etapa === 'OPERACIONES') return ['PENDIENTE', 'OBSERVADO', 'RECHAZADO', 'APROBADO'].includes(estado);
        return false;
    }

    function applyResultadoActionButtonsState(solicitud) {
        resultadoActionsLockedByStage = shouldDisableResultadoActions(solicitud);
        const btnCalcular = document.getElementById('btnCalcularCuotas');
        const btnContinuarCalculo = document.getElementById('btnContinuarDesdeCalculo');

        if (btnCalcular) {
            btnCalcular.disabled = resultadoActionsLockedByStage;
            btnCalcular.setAttribute('aria-disabled', String(resultadoActionsLockedByStage));
        }
        if (btnContinuarCalculo) {
            btnContinuarCalculo.disabled = resultadoActionsLockedByStage;
            btnContinuarCalculo.classList.toggle('is-disabled', resultadoActionsLockedByStage || !tieneFilaCalculoSeleccionada());
            btnContinuarCalculo.setAttribute('aria-disabled', String(resultadoActionsLockedByStage || !tieneFilaCalculoSeleccionada()));
        }
    }

    function applyResultadoReadOnlyState(readOnly, solicitud = null) {
        const moduloResultado = document.getElementById('moduloResultado');
        if (!moduloResultado) return;

        moduloResultado.querySelectorAll('input, select, textarea').forEach(control => {
            if (!control.dataset.resultadoOriginalDisabled) {
                control.dataset.resultadoOriginalDisabled = control.disabled ? 'true' : 'false';
            }
            control.disabled = readOnly || control.dataset.resultadoOriginalDisabled === 'true';
        });

        const btnContinuar = document.getElementById('btnContinuarSolicitud');
        if (btnContinuar) btnContinuar.style.display = readOnly ? 'none' : 'inline-flex';

        const btnRegresarCalculo = document.getElementById('btnRegresarCalculo');
        if (btnRegresarCalculo) btnRegresarCalculo.style.display = readOnly ? 'none' : 'inline-flex';

        applyResultadoActionButtonsState(solicitud);
    }

    function getCurrentSolicitudActiva() {
        return solicitudes.find(s => s.id === currentSolicitudId) || null;
    }

    function getStageSimulacionGuardControls() {
        const moduloResultado = document.getElementById('moduloResultado');
        if (!moduloResultado) return [];
        return Array.from(moduloResultado.querySelectorAll('input, select, textarea')).filter(control => {
            if (!control || control.type === 'hidden' || control.type === 'button' || control.type === 'submit') return false;
            if (control.readOnly || control.disabled) return false;
            return true;
        });
    }

    function activarGuardiaCambiosStageSimulacion(solicitudId) {
        stageSimulacionChangeGuardSolicitudId = solicitudId || null;
        stageSimulacionChangeGuardBaseline = new WeakMap();
        getStageSimulacionGuardControls().forEach(control => {
            stageSimulacionChangeGuardBaseline.set(control, control.value);
        });
    }

    function refrescarBaselineGuardiaCambiosStageSimulacion() {
        if (!stageSimulacionChangeGuardSolicitudId) return;
        getStageSimulacionGuardControls().forEach(control => {
            stageSimulacionChangeGuardBaseline.set(control, control.value);
        });
    }

    function desactivarGuardiaCambiosStageSimulacion() {
        stageSimulacionChangeGuardSolicitudId = null;
        stageSimulacionChangeGuardBaseline = new WeakMap();
        pendingStageSimulacionChange = null;
        simulacionStageChangeCancelHandler = null;
    }

    function limpiarConfirmacionCambioStageSimulacionHandler() {
        if (simulacionStageChangeCancelHandler) {
            const cancelBtn = document.getElementById('modalBtnCancel');
            if (cancelBtn) cancelBtn.removeEventListener('click', simulacionStageChangeCancelHandler, true);
        }
        simulacionStageChangeCancelHandler = null;
    }

    function restaurarCambioStageSimulacionPendiente() {
        if (!pendingStageSimulacionChange) return;
        const { control, previousValue } = pendingStageSimulacionChange;
        pendingStageSimulacionChange = null;
        limpiarConfirmacionCambioStageSimulacionHandler();
        if (control && document.contains(control)) {
            suspendStageSimulacionChangeGuard = true;
            control.value = previousValue;
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.dispatchEvent(new Event('change', { bubbles: true }));
            suspendStageSimulacionChangeGuard = false;
            stageSimulacionChangeGuardBaseline.set(control, previousValue);
        }
    }

    function confirmarCambioStageSimulacion() {
        pendingStageSimulacionChange = null;
        limpiarConfirmacionCambioStageSimulacionHandler();
        const solicitudActual = getCurrentSolicitudActiva();
        if (!solicitudActual) return;

        solicitudActual.etapa = 'SIMULACIÓN';
        solicitudActual.estado = 'PENDIENTE';
        renderStageNavigation('resultadoStageTabs', solicitudActual.etapa, solicitudActual.estado, 'SIMULACION');
        desactivarGuardiaCambiosStageSimulacion();
        if (typeof applyBandejaFilters === 'function') applyBandejaFilters();
        showToast('La solicitud volvió a etapa Simulación.', 'success');
    }

    function mostrarConfirmacionCambioStageSimulacion(control, previousValue) {
        if (!control) return;
        pendingStageSimulacionChange = { control, previousValue };
        limpiarConfirmacionCambioStageSimulacionHandler();

        modalTitle.textContent = 'Confirmación de cambios';
        modalBody.innerHTML = `
            <div class="popup-confirmacion-simulacion">
                <div class="popup-confirmacion-icon">
                    <span class="material-icons-outlined">warning_amber</span>
                </div>
                <p class="popup-confirmacion-text">
                    ¿Está seguro de realizar cambios, tendrá que volver a calcular?
                </p>
            </div>
        `;

        const cancelBtn = document.getElementById('modalBtnCancel');
        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);

        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = 'Cancelar';
        newActionBtn.style.display = 'inline-flex';
        newActionBtn.textContent = 'Aceptar';

        simulacionStageChangeCancelHandler = (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            restaurarCambioStageSimulacionPendiente();
            closeModal();
        };
        cancelBtn.addEventListener('click', simulacionStageChangeCancelHandler, true);

        newActionBtn.addEventListener('click', () => {
            confirmarCambioStageSimulacion();
            closeModal();
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function debeActivarConfirmacionCambioStageSimulacion(control) {
        if (suspendStageSimulacionChangeGuard || pendingStageSimulacionChange) return false;
        if (!stageSimulacionChangeGuardSolicitudId || currentSolicitudId !== stageSimulacionChangeGuardSolicitudId) return false;
        if (!control || control.readOnly || control.disabled || control.type === 'hidden') return false;
        const solicitudActual = getCurrentSolicitudActiva();
        return !!(solicitudActual && normalizarEtapa(solicitudActual.etapa) === 'SOLICITUD');
    }

    function manejarCambioStageSimulacionProtegido(event) {
        const control = event.target;
        if (!debeActivarConfirmacionCambioStageSimulacion(control)) return;
        const previousValue = stageSimulacionChangeGuardBaseline.has(control)
            ? stageSimulacionChangeGuardBaseline.get(control)
            : control.defaultValue || '';
        const currentValue = control.value;
        if (String(previousValue) === String(currentValue)) return;
        mostrarConfirmacionCambioStageSimulacion(control, previousValue);
    }

    document.addEventListener('input', (event) => {
        if (!event.target.closest('#moduloResultado')) return;
        manejarCambioStageSimulacionProtegido(event);
    }, true);

    document.addEventListener('change', (event) => {
        if (!event.target.closest('#moduloResultado')) return;
        manejarCambioStageSimulacionProtegido(event);
    }, true);

    function renderStageNavigation(containerId, etapaActual = 'SIMULACIÓN', estadoActual = 'PENDIENTE', etapaSeleccionada = null) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const etapaKey = getEtapaNavigationKey(etapaActual);
        const currentIndex = ETAPAS_SOLICITUD_NAV.findIndex(stage => stage.key === etapaKey);

        if (currentIndex < 0) {
            container.innerHTML = '';
            container.hidden = true;
            return;
        }

        const selectedKey = getEtapaNavigationKey(etapaSeleccionada || etapaActual);
        const selectedIndex = ETAPAS_SOLICITUD_NAV.findIndex(stage => stage.key === selectedKey);
        const etapasVisibles = ETAPAS_SOLICITUD_NAV.slice(0, currentIndex + 1);
        const statusClass = getStageStatusClass(estadoActual);
        const navigationEnabled = canUseStageNavigationForCurrentFlow();
        container.hidden = false;
        container.classList.toggle('stage-nav-clickable', navigationEnabled);
        container.style.setProperty('--stage-tabs-count', etapasVisibles.length);
        container.innerHTML = etapasVisibles.map((stage, index) => {
            const isSelected = index === selectedIndex;
            const isCompleted = index < currentIndex;
            const stageStateClass = isSelected ? 'stage-current' : (isCompleted ? 'stage-completed' : 'stage-pending');
            const enabledAttributes = navigationEnabled
                ? `aria-label="Ir a la etapa ${stage.label}"`
                : 'disabled aria-disabled="true"';

            return `
                <button type="button" class="stage-nav-tab ${stageStateClass} stage-status-${statusClass}" ${enabledAttributes} ${isSelected ? 'aria-current="step"' : ''} data-stage="${stage.key}">
                    <span class="stage-nav-number" aria-hidden="true">${stage.order}</span>
                    <span class="stage-nav-title">${escapeHtml(stage.label)}</span>
                </button>
            `;
        }).join('');
    }

    function showStageModule(moduleId) {
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        const module = document.getElementById(moduleId);
        if (module) module.classList.add('active');
        navItems.forEach(n => n.classList.remove('active'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderCurrentStageNavigation(selectedStageKey) {
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
        if (!solicitudActual) return;
        const activePage = document.querySelector('.module-page.active');
        if (!activePage) return;

        if (activePage.id === 'moduloResultado') {
            renderStageNavigation('resultadoStageTabs', solicitudActual.etapa || 'SIMULACIÓN', solicitudActual.estado || 'PENDIENTE', selectedStageKey || 'SIMULACION');
        } else if (activePage.id === 'moduloRegistroSolicitud') {
            renderStageNavigation('registroStageTabs', solicitudActual.etapa || 'SOLICITUD', solicitudActual.estado || 'PENDIENTE', selectedStageKey || 'SOLICITUD');
        } else if (activePage.id === 'moduloBandejaDocumentaria') {
            renderStageNavigation('documentariaStageTabs', solicitudActual.etapa || 'DOCUMENTARIA', solicitudActual.estado || 'PENDIENTE', selectedStageKey || getEtapaNavigationKey(solicitudActual.etapa || 'DOCUMENTARIA'));
        }
    }

    function showResultadoStageFromNavigation(solicitud) {
        if (!solicitud) return;
        currentSolicitudId = solicitud.id;
        const parts = (solicitud.documento || '').split(' - ');
        const tipoDoc = parts[0] || 'DNI';
        const nroDoc = parts[1] || '';
        const mockData = generateMockEvaluacion(nroDoc);

        document.getElementById('resSolicitudId').textContent = solicitud.id;
        document.getElementById('resFechaHora').textContent = solicitud.fecha || '-';
        setResultadoDocumento(tipoDoc, nroDoc);
        actualizarConyugeResultado();
        document.getElementById('resMontoPreaprobado').textContent = `S/ ${mockData.montoPreaprobado}`;
        document.getElementById('resCalificacion').textContent = mockData.califica ? 'CALIFICA' : 'NO CALIFICA';
        document.getElementById('resCalificacionMsg').textContent = mockData.califica
            ? 'El cliente cumple con los criterios de evaluación.'
            : 'El cliente no cumple con los criterios de evaluación.';
        document.getElementById('resSegmentoRiesgo').textContent = mockData.segmentoRiesgo;
        document.getElementById('resIngresoEstimado').textContent = `S/ ${mockData.ingresoEstimado}`;
        syncIngresoEstimadoCalculo();
        document.getElementById('resCuotaMaxima').textContent = `S/ ${mockData.capacidadCuotaMaxima}`;
        const calcCuotaMaxima = document.getElementById('calcCuotaMaxima');
        if (calcCuotaMaxima) calcCuotaMaxima.value = `S/ ${mockData.capacidadCuotaMaxima}`;
        if (solicitud.precioVehiculoUsd && simPrecioVehiculoUsd) {
            simPrecioVehiculoUsd.value = formatearDecimalConMiles(solicitud.precioVehiculoUsd);
            syncPrecioVehiculoSimulacionCalculo();
        }

        const calificacionCard = document.querySelector('.resultado-calificacion');
        const calificacionIcon = calificacionCard?.querySelector('.resultado-calificacion-icon .material-icons-outlined');
        if (calificacionCard && calificacionIcon) {
            if (mockData.califica) {
                calificacionCard.classList.add('califica');
                calificacionCard.classList.remove('no-califica');
                calificacionIcon.textContent = 'check_circle';
            } else {
                calificacionCard.classList.remove('califica');
                calificacionCard.classList.add('no-califica');
                calificacionIcon.textContent = 'cancel';
            }
        }

        showStageModule('moduloResultado');
        applyResultadoReadOnlyState(true, solicitud);
        renderStageNavigation('resultadoStageTabs', solicitud.etapa || 'SIMULACIÓN', solicitud.estado || 'PENDIENTE', 'SIMULACION');
        showFlujoTab('resultado');
    }

    function showSolicitudStageFromNavigation(solicitud) {
        if (!solicitud) return;
        currentSolicitudId = solicitud.id;

        if (normalizarEtapa(solicitud.etapa) === 'SIMULACION') {
            continuarARegistroSolicitud();
            return;
        }

        // Cargar siempre la pantalla completa de SOLICITUD con los datos de la
        // solicitud seleccionada. Esto evita reutilizar información de una
        // solicitud revisada anteriormente al navegar desde DOCUMENTARIA.
        handleRevisarAction(solicitud);
        renderStageNavigation(
            'registroStageTabs',
            solicitud.etapa || 'SOLICITUD',
            solicitud.estado || 'PENDIENTE',
            'SOLICITUD'
        );
    }

    function navigateToStageFromNavigation(stageKey) {
        if (!canUseStageNavigationForCurrentFlow()) return;
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
        if (!solicitudActual) return;

        saveCurrentRegistrationState();
        persistCurrentDocumentariaState();

        const targetStage = getEtapaNavigationKey(stageKey);
        const currentStage = getEtapaNavigationKey(solicitudActual.etapa || 'SIMULACIÓN');
        const currentIndex = ETAPAS_SOLICITUD_NAV.findIndex(stage => stage.key === currentStage);
        const targetIndex = ETAPAS_SOLICITUD_NAV.findIndex(stage => stage.key === targetStage);
        if (targetIndex < 0 || targetIndex > currentIndex) return;

        if (targetStage === 'SIMULACION') {
            const vieneDesdeSolicitud = normalizarEtapa(solicitudActual.etapa) === 'SOLICITUD';
            showResultadoStageFromNavigation(solicitudActual);
            if (vieneDesdeSolicitud) {
                activarGuardiaCambiosStageSimulacion(solicitudActual.id);
            } else {
                desactivarGuardiaCambiosStageSimulacion();
            }
        } else if (targetStage === 'SOLICITUD' || targetStage === 'RIESGOS') {
            desactivarGuardiaCambiosStageSimulacion();
            showSolicitudStageFromNavigation(solicitudActual);
        } else if (['DOCUMENTARIA', 'FIRMA', 'OPERACIONES'].includes(targetStage)) {
            desactivarGuardiaCambiosStageSimulacion();
            showBandejaDocumentaria(solicitudActual);
            renderStageNavigation('documentariaStageTabs', solicitudActual.etapa || targetStage, solicitudActual.estado || 'PENDIENTE', targetStage);
        }
    }

    document.addEventListener('click', (event) => {
        const stageTab = event.target.closest('.stage-nav-tab');
        if (!stageTab || stageTab.disabled || !stageTab.dataset.stage) return;
        if (!canUseStageNavigationForCurrentFlow()) return;
        event.preventDefault();
        navigateToStageFromNavigation(stageTab.dataset.stage);
    });

    // ============================
    // BARRA FIJA — IDENTIFICACIÓN DEL CLIENTE EN SOLICITUD
    // ============================
    const registroStickyClientBar = document.getElementById('registroIdentificacionSticky');
    const registroStickyClientFields = [
        { originalId: 'regTipoDoc', stickyId: 'stickyRegTipoDoc' },
        { originalId: 'regNroDoc', stickyId: 'stickyRegNroDoc' },
        { originalId: 'regNombres', stickyId: 'stickyRegNombres' },
        { originalId: 'regApePaterno', stickyId: 'stickyRegApePaterno' }
    ];

    function syncRegistroStickyClientFields() {
        registroStickyClientFields.forEach(({ originalId, stickyId }) => {
            const originalField = document.getElementById(originalId);
            const stickyField = document.getElementById(stickyId);
            if (originalField && stickyField && stickyField.value !== originalField.value) {
                stickyField.value = originalField.value;
            }
        });
    }

    function updateRegistroStickyClientBar() {
        const moduloRegistro = document.getElementById('moduloRegistroSolicitud');
        if (!registroStickyClientBar || !moduloRegistro) return;

        const isRegistroActive = moduloRegistro.classList.contains('active');
        const firstClientField = document.getElementById('regTipoDoc')?.closest('.form-group');

        if (!isRegistroActive || !firstClientField) {
            registroStickyClientBar.classList.remove('is-visible');
            registroStickyClientBar.setAttribute('aria-hidden', 'true');
            return;
        }

        syncRegistroStickyClientFields();
        const rootStyles = getComputedStyle(document.documentElement);
        const headerHeight = parseFloat(rootStyles.getPropertyValue('--header-height')) || 56;
        const stickyTriggerTop = headerHeight + 12;
        const shouldShowStickyBar = firstClientField.getBoundingClientRect().top <= stickyTriggerTop;

        registroStickyClientBar.classList.toggle('is-visible', shouldShowStickyBar);
        registroStickyClientBar.setAttribute('aria-hidden', String(!shouldShowStickyBar));
    }

    function setupRegistroStickyClientBar() {
        if (!registroStickyClientBar) return;

        registroStickyClientFields.forEach(({ originalId, stickyId }) => {
            const originalField = document.getElementById(originalId);
            const stickyField = document.getElementById(stickyId);
            if (!originalField || !stickyField) return;

            originalField.addEventListener('input', syncRegistroStickyClientFields);
            originalField.addEventListener('change', syncRegistroStickyClientFields);

            stickyField.addEventListener('input', () => {
                if (!stickyField.readOnly && !stickyField.disabled) {
                    originalField.value = stickyField.value;
                }
            });
            stickyField.addEventListener('change', () => {
                if (!stickyField.readOnly && !stickyField.disabled) {
                    originalField.value = stickyField.value;
                }
            });
        });

        const moduloRegistro = document.getElementById('moduloRegistroSolicitud');
        if (moduloRegistro) {
            const observer = new MutationObserver(updateRegistroStickyClientBar);
            observer.observe(moduloRegistro, { attributes: true, attributeFilter: ['class'] });
        }

        window.addEventListener('scroll', updateRegistroStickyClientBar, { passive: true });
        window.addEventListener('resize', updateRegistroStickyClientBar);
        updateRegistroStickyClientBar();
    }

    setupRegistroStickyClientBar();

    // ============================
    // MOCK DATA — Bandeja de Entrada
    // ============================
    const solicitudes = [
        {
            id: 'EFE004',
            cliente: 'Pérez García Juan',
            documento: 'DNI - 71865987',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 21,480.00',
            fecha: '22-05-2026 15:30:00',
            concesionario: 'Toyota',
            tienda: 'San Miguel',
            etapa: 'DOCUMENTARIA',
            estado: 'PENDIENTE',
            telefono: '922159933',
            comentarioEjecutivo: {
                ejecutivo: 'ALOCHA - Ejecutivo',
                fechaHora: '22-05-2026 14:40:00',
                comentario: 'Se registró la información completa de la solicitud y se adjuntaron los documentos requeridos para la evaluación.'
            },
            riesgosDecision: {
                tipo: 'APROBADO',
                analista: 'Luis Rojas - Analista de Riesgos',
                motivo: 'Solicitud aprobada conforme a políticas de crédito',
                fechaHora: '22-05-2026 15:30:00',
                comentario: 'La solicitud cumple con las políticas de capacidad de pago y evaluación crediticia. Se aprueba su continuidad a la etapa Documentaria.'
            }
        },
        {
            id: 'EFE001',
            cliente: 'Méndez Quispe Carlos',
            documento: 'DNI - 12345678',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 48,500.00',
            fecha: '20-05-2026 15:30:00',
            concesionario: 'Toyota',
            tienda: 'Puruchuco',
            etapa: 'SIMULACIÓN',
            estado: 'PENDIENTE',
            telefono: '987654321'
        },
        {
            id: 'EFE002',
            cliente: 'López Fernández María',
            documento: 'DNI - 12345678',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 65,200.00',
            fecha: '20-05-2026 15:30:00',
            concesionario: 'Hyundai',
            tienda: 'San Miguel',
            etapa: 'RIESGOS',
            estado: 'PENDIENTE',
            telefono: '912345678'
        },
        {
            id: 'POP001',
            cliente: 'Torres Delgado Ana',
            documento: 'DNI - 34567890',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 52,000.00',
            fecha: '19-05-2026 11:20:00',
            concesionario: 'Hyundai',
            tienda: 'Puruchuco',
            etapa: 'OPERACIONES',
            estado: 'OBSERVADO',
            telefono: '945612378',
            comentarioEjecutivo: {
                ejecutivo: 'ALOCHA - Ejecutivo',
                fechaHora: '19-05-2026 11:20:00',
                comentario: 'Se adjuntan documentos iniciales del cliente y se deriva la solicitud para revisión.'
            },
            downloadedPostAprobacionDocs: [
                'Carta de aprobación',
                'Contrato de crédito',
                'Pagaré',
                'Hoja resumen (TCEA)',
                'Cronograma preliminar',
                'Póliza de seguro vehicular',
                'Póliza de desgravamen',
                'Contrato de garantía'
            ],
            checklist2Docs: [
                { id: 'POP001-CL2-001', name: 'DNI_cliente_POP001.pdf' },
                { id: 'POP001-CL2-002', name: 'Contrato_credito_firmado_POP001.pdf' },
                { id: 'POP001-CL2-003', name: 'Garantia_mobiliaria_POP001.pdf' }
            ],
            riesgosDecision: {
                tipo: 'APROBADO',
                analista: 'Luis Rojas - Analista de Riesgos',
                motivo: 'Solicitud aprobada conforme a políticas de crédito',
                fechaHora: '19-05-2026 16:05:00',
                comentario: 'La solicitud cumple con la evaluación crediticia y puede continuar a la revisión de Operaciones.'
            },
            operacionesObservacion: {
                tipo: 'OBSERVADO',
                analista: 'María Fernández - Operaciones',
                motivo: 'Documento observado',
                fechaHora: '20-05-2026 10:35:00',
                comentario: 'Se observa que el archivo de garantía mobiliaria no cuenta con el dato completo del VIN. Regularizar el documento y reenviar a operaciones.'
            },
            operacionesRespuestaHabilitada: false,
            operacionesRespuestaEnviada: false,
            checklist2Comentario: '',
            postAprobacionCompletionPopupShown: true
        },
        {
            id: 'POP003',
            cliente: 'García Paredes Luis',
            documento: 'DNI - 56789012',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 72,350.00',
            fecha: '18-05-2026 16:40:00',
            concesionario: 'Hyundai',
            tienda: 'La Molina',
            etapa: 'RIESGOS',
            estado: 'OBSERVADO',
            telefono: '923456789',
            cartera: 'FULL',
            documentos: [
                { id: 'POP003-CL1-001', name: 'DNI_cliente_POP003.pdf' },
                { id: 'POP003-CL1-002', name: 'Sustento_ingresos_POP003.pdf' }
            ],
            chkManualDni: true,
            chkManualRecibo: false,
            chkManualCotizacion: true,
            registroEditableData: {
                ingresos: [
                    { categoria: '5TA', perfil: 'FORMAL', situacion: 'DEPENDIENTE', fecha: '15/04/2021', ruc: '20123456789', monto: 'S/ 4,850.00', anualizado: 'NO' },
                    { categoria: '4TA', perfil: 'FORMAL', situacion: 'INDEPENDIENTE', fecha: '01/02/2024', ruc: '20604578912', monto: 'S/ 1,350.00', anualizado: 'NO' }
                ],
                vehiculo: {
                    regVehEstado: 'Nuevo',
                    regVehConcesionario: 'Hyundai',
                    regVehTienda: 'La Molina',
                    regVehTipoDocVendedor: 'DNI',
                    regVehNroDocVendedor: '45231890',
                    regVehVendedor: 'ALOCHA',
                    regVehMarca: 'Hyundai',
                    regVehModelo: 'Tucson',
                    regVehAnio: '2026',
                    regVehTarjetaNombre: 'TITULAR'
                },
                credito: {
                    regSimProducto: 'Credito Vehicular',
                    regSimCampana: 'SUV Mayo 2026',
                    regSimMoneda: 'Soles (S/.)',
                    regSimTipoCambio: '3.78',
                    regSimPrecioVeh: 'S/ 72,350.00',
                    regSimCuotaInicial: 'S/ 12,000.00',
                    regSimTea: '12.80%',
                    regSimPlazo: '36 meses',
                    regSimDiaPago: '05',
                    regTotalFinanciamiento: 'S/ 60,350.00'
                },
                gastos: {
                    regGastosNotariales: 'SI',
                    regGastosRegistrales: 'SI',
                    regGastosDelivery: 'NO',
                    regPlanGpx: 'Premium',
                    regGastosInclGpx: 'S/ 650.00',
                    regCuotasDobles: 'No',
                    regMesesCuotasDobles: '',
                    regIncluirPortes: 'Si'
                },
                seguros: {
                    regSegVehicular: 'Financiado',
                    regSegVehCosto: 'S/ 1,850.00',
                    regSegDesgravamen: 'SI',
                    regSegDesgProd: 'Individual'
                }
            },
            comentarioEjecutivo: {
                ejecutivo: 'ALOCHA - Ejecutivo',
                fechaHora: '18-05-2026 15:55:00',
                comentario: 'Cliente declara ingresos adicionales y adjunta sustento para evaluación de capacidad de pago.'
            },
            riesgosDecision: {
                tipo: 'OBSERVADO',
                analista: 'Luis Rojas - Riesgos',
                motivo: 'Sustento de ingresos incompleto',
                fechaHora: '18-05-2026 16:40:00',
                comentario: 'Se requiere adjuntar boletas actualizadas y validar continuidad laboral antes de continuar con la evaluación.'
            }
        },
        {
            id: 'POP002',
            cliente: 'Huamán Ramos Patricia',
            documento: 'DNI - 45678901',
            tipoCredito: 'Crédito vehicular',
            monto: 'S/ 41,900.00',
            fecha: '18-05-2026 10:45:00',
            concesionario: 'Toyota',
            tienda: 'San Miguel',
            etapa: 'RIESGOS',
            estado: 'RECHAZADO',
            telefono: '976543210',
            comentarioEjecutivo: {
                ejecutivo: 'ALOCHA - Ejecutivo',
                fechaHora: '18-05-2026 10:12:00',
                comentario: 'Cliente solicita evaluación con cuota inicial mínima y financiamiento según campaña vigente.'
            },
            riesgosDecision: {
                tipo: 'RECHAZADO',
                analista: 'Ana Torres - Riesgos',
                motivo: 'No cumple política de capacidad de pago',
                fechaHora: '18-05-2026 10:45:00',
                comentario: 'La cuota resultante excede la capacidad permitida según ingreso estimado y endeudamiento vigente.'
            }
        }
    ];

    const SOLICITUD_FIRMA_AUTOMATICA_ID = 'EFE004';
    const SOLICITUD_FIRMA_STORAGE_KEY = 'efectivaSolicitudEFE004FirmaState';

    function isSolicitudFirmaAutomatica(solicitud) {
        return !!(solicitud && solicitud.id === SOLICITUD_FIRMA_AUTOMATICA_ID);
    }

    function loadSolicitudFirmaAutomaticaState() {
        try {
            const stored = localStorage.getItem(SOLICITUD_FIRMA_STORAGE_KEY);
            if (!stored) return;
            const parsed = JSON.parse(stored);
            const solicitud = solicitudes.find(sol => sol.id === SOLICITUD_FIRMA_AUTOMATICA_ID);
            if (solicitud && parsed && parsed.id === SOLICITUD_FIRMA_AUTOMATICA_ID) {
                Object.assign(solicitud, parsed);
            }
        } catch (error) {
            console.warn('No se pudo recuperar el estado de firma de EFE004:', error);
        }
    }

    function saveSolicitudFirmaAutomaticaState(solicitud) {
        if (!isSolicitudFirmaAutomatica(solicitud)) return;
        try {
            const state = {
                id: solicitud.id,
                etapa: solicitud.etapa,
                estado: solicitud.estado,
                downloadedPostAprobacionDocs: Array.isArray(solicitud.downloadedPostAprobacionDocs) ? solicitud.downloadedPostAprobacionDocs : [],
                checklist2Docs: Array.isArray(solicitud.checklist2Docs) ? solicitud.checklist2Docs.map(doc => ({ id: doc.id, name: doc.name })) : [],
                checklist2Comentario: solicitud.checklist2Comentario || '',
                contratoGarantiaGenerado: !!solicitud.contratoGarantiaGenerado,
                postAprobacionCollapsed: !!solicitud.postAprobacionCollapsed,
                postAprobacionCompletionPopupShown: !!solicitud.postAprobacionCompletionPopupShown
            };
            localStorage.setItem(SOLICITUD_FIRMA_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.warn('No se pudo guardar el estado de firma de EFE004:', error);
        }
    }

    loadSolicitudFirmaAutomaticaState();

    // ============================
    // SIDEBAR TOGGLE
    // ============================
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    // ============================
    // USER DROPDOWN
    // ============================
    headerUser.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!headerUser.contains(e.target)) {
            userDropdown.classList.remove('active');
        }
    });

    // ============================
    // MODULE NAVIGATION
    // ============================
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            saveCurrentRegistrationState();
            desactivarGuardiaCambiosStageSimulacion();
            stageNavigationEnabledForCurrentFlow = false;
            const targetModule = item.dataset.module;

            // Update active nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Show target module
            modulePages.forEach(page => page.classList.remove('active'));

            if (targetModule === 'simulacion') {
                document.getElementById('moduloSimulacion').classList.add('active');
            } else if (targetModule === 'bandeja') {
                document.getElementById('moduloBandeja').classList.add('active');
                applyBandejaFilters();
            }
        });
    });

    // ============================
    // SIMULACIÓN — Form Logic
    // ============================

    // Toggle Cónyuge
    toggleConyuge.addEventListener('change', () => {
        const isChecked = toggleConyuge.checked;
        conyugeData.style.display = isChecked ? 'block' : 'none';

        if (isChecked) {
            labelNo.classList.remove('active-label');
            labelSi.classList.add('active-label');
        } else {
            labelNo.classList.add('active-label');
            labelSi.classList.remove('active-label');
            // Clear cónyuge fields
            document.getElementById('tipoDocConyuge').value = 'DNI';
            document.getElementById('nroDocConyuge').value = '';
        }
    });

    let simulacionValidationAttempted = false;

    function validarDocumentoPrincipalSimulacion(tipoDoc, docValue) {
        const valor = String(docValue || '').trim();
        if (tipoDoc === 'DNI') return /^\d{8}$/.test(valor);
        if (tipoDoc === 'CE') return /^\d{6,12}$/.test(valor);
        if (tipoDoc === 'RUC') return /^\d{11}$/.test(valor);
        if (tipoDoc === 'PASAPORTE') return valor.length >= 5;
        return false;
    }

    function validarDocumentoConyugeSimulacion(tipoDoc, docValue) {
        const valor = String(docValue || '').trim();
        if (tipoDoc === 'DNI') return /^\d{8}$/.test(valor);
        if (tipoDoc === 'CE') return /^\d{1,12}$/.test(valor);
        return false;
    }

    function getTipoDocConyugeControl() {
        return document.getElementById('tipoDocConyuge');
    }

    function getNroDocConyugeControl() {
        return document.getElementById('nroDocConyuge');
    }

    function actualizarRestriccionesDocumentoConyuge() {
        const tipoDocConyuge = getTipoDocConyugeControl();
        const nroDocConyuge = getNroDocConyugeControl();
        if (!tipoDocConyuge || !nroDocConyuge) return;
        const maxLength = tipoDocConyuge.value === 'CE' ? 12 : 8;
        nroDocConyuge.maxLength = maxLength;
        nroDocConyuge.value = nroDocConyuge.value.replace(/\D/g, '').slice(0, maxLength);
    }

    function limpiarHighlightRequeridoSimulacion(field) {
        if (!field) return;
        field.classList.remove('input-attention');
        field.removeAttribute('aria-invalid');
        const group = field.closest('.form-group, .simulacion-header-field');
        if (group) group.classList.remove('field-attention');
    }

    function marcarCampoRequeridoSimulacion(field) {
        if (!field) return;
        field.classList.remove('input-attention');
        void field.offsetWidth;
        field.classList.add('input-attention');
        field.setAttribute('aria-invalid', 'true');
        const group = field.closest('.form-group, .simulacion-header-field');
        if (group) group.classList.add('field-attention');
    }

    function getCamposRequeridosFaltantesSimulacion() {
        const missingFields = [];
        const docValue = nroDocumento ? nroDocumento.value.trim() : '';
        const tipoDoc = tipoDocumento ? tipoDocumento.value : 'DNI';
        const precioVehiculo = simPrecioVehiculoUsd ? parseMoneyValue(simPrecioVehiculoUsd.value) : 0;

        if (!validarDocumentoPrincipalSimulacion(tipoDoc, docValue)) missingFields.push(nroDocumento);
        if (precioVehiculo <= 0) missingFields.push(simPrecioVehiculoUsd);

        if (toggleConyuge && toggleConyuge.checked) {
            const tipoDocConyuge = getTipoDocConyugeControl();
            const nroDocConyuge = getNroDocConyugeControl();
            if (!tipoDocConyuge || !tipoDocConyuge.value) missingFields.push(tipoDocConyuge);
            if (!validarDocumentoConyugeSimulacion(tipoDocConyuge ? tipoDocConyuge.value : 'DNI', nroDocConyuge ? nroDocConyuge.value : '')) {
                missingFields.push(nroDocConyuge);
            }
        }

        return missingFields.filter(Boolean);
    }

    function actualizarHighlightsRequeridosSimulacion() {
        const watchedFields = [
            nroDocumento,
            simPrecioVehiculoUsd,
            getTipoDocConyugeControl(),
            getNroDocConyugeControl()
        ].filter(Boolean);
        const missingFields = getCamposRequeridosFaltantesSimulacion();

        watchedFields.forEach(field => {
            if (missingFields.includes(field) && simulacionValidationAttempted) {
                marcarCampoRequeridoSimulacion(field);
            } else {
                limpiarHighlightRequeridoSimulacion(field);
            }
        });

        return missingFields;
    }

    function resaltarCamposFaltantesSimulacion() {
        simulacionValidationAttempted = true;
        const missingFields = actualizarHighlightsRequeridosSimulacion();
        if (missingFields.length) {
            missingFields[0].focus({ preventScroll: true });
            missingFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return missingFields.length === 0;
    }

    function validateSimulacionForm() {
        actualizarRestriccionesDocumentoConyuge();
        const isValid = getCamposRequeridosFaltantesSimulacion().length === 0;

        if (isValid) {
            btnSimular.disabled = false;
            btnSimular.classList.add('enabled');
        } else {
            btnSimular.disabled = true;
            btnSimular.classList.remove('enabled');
        }

        actualizarHighlightsRequeridosSimulacion();
        return isValid;
    }

    nroDocumento.addEventListener('input', validateSimulacionForm);
    tipoDocumento.addEventListener('change', validateSimulacionForm);

    const tipoDocConyugeControl = getTipoDocConyugeControl();
    const nroDocConyugeControl = getNroDocConyugeControl();

    if (nroDocConyugeControl) {
        nroDocConyugeControl.addEventListener('input', (e) => {
            actualizarRestriccionesDocumentoConyuge();
            validateSimulacionForm();
        });
    }

    if (tipoDocConyugeControl) {
        tipoDocConyugeControl.addEventListener('change', () => {
            actualizarRestriccionesDocumentoConyuge();
            validateSimulacionForm();
        });
    }

    toggleConyuge.addEventListener('change', () => {
        setTimeout(validateSimulacionForm, 100);
    });
    actualizarRestriccionesDocumentoConyuge();

    // Restrict DNI input to numbers only
    nroDocumento.addEventListener('input', (e) => {
        const tipo = tipoDocumento.value;
        if (tipo === 'DNI' || tipo === 'RUC') {
            e.target.value = e.target.value.replace(/\D/g, '');
        }
    });

    // Restrict phone to numbers only
    nroTelefono.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/\D/g, '');
    });

    function syncPrecioVehiculoSimulacionCalculo() {
        const calcPrecioVehiculo = document.getElementById('calcPrecioUsd');
        if (!simPrecioVehiculoUsd || !calcPrecioVehiculo) return;

        const precioSimulacion = simPrecioVehiculoUsd.value.trim();
        if (!precioSimulacion || parseMoneyValue(precioSimulacion) <= 0) return;

        calcPrecioVehiculo.value = formatearDecimal(precioSimulacion);
        validarCuotaInicialContraPrecio(false);
    }

    if (simPrecioVehiculoUsd) {
        simPrecioVehiculoUsd.addEventListener('input', (e) => {
            e.target.value = normalizarDecimalInput(e.target.value);
            validateSimulacionForm();
        });
        simPrecioVehiculoUsd.addEventListener('blur', (e) => {
            e.target.value = formatearDecimalConMiles(e.target.value);
            syncPrecioVehiculoSimulacionCalculo();
            validateSimulacionForm();
        });
    }

    const simularActions = btnSimular ? btnSimular.closest('.form-footer-actions') : null;
    if (simularActions) {
        simularActions.addEventListener('click', (event) => {
            if (!btnSimular || !btnSimular.disabled) return;
            const rect = btnSimular.getBoundingClientRect();
            const clickInsideBtnSimular = event.clientX >= rect.left && event.clientX <= rect.right
                && event.clientY >= rect.top && event.clientY <= rect.bottom;
            if (!clickInsideBtnSimular) return;
            event.preventDefault();
            resaltarCamposFaltantesSimulacion();
        });
    }

    if (calcTelefonoPoliticas) {
        calcTelefonoPoliticas.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            e.target.setCustomValidity('');
            clearTelefonoPoliticasHighlight();
            updateContinuarDesdeCalculoState();
        });
    }

    function getSimulacionUbicacion() {
        return {
            concesionario: simConcesionario ? simConcesionario.value : 'Hyundai',
            sucursal: simSucursal ? simSucursal.value : 'Puruchuco'
        };
    }

    function setSelectValueByText(selectId, value) {
        const select = document.getElementById(selectId);
        if (!select || !value) return;

        const normalizedValue = String(value).trim().toUpperCase();
        const matchedOption = Array.from(select.options).find(option =>
            option.value.trim().toUpperCase() === normalizedValue ||
            option.textContent.trim().toUpperCase() === normalizedValue
        );

        if (matchedOption) {
            select.value = matchedOption.value;
            return;
        }

        const newOption = new Option(String(value).trim(), String(value).trim());
        select.add(newOption);
        select.value = newOption.value;
    }

    function getTipoCambioCalculoValue() {
        const calcTipoCambioInput = document.getElementById('calcTipoCambio');
        return calcTipoCambioInput && calcTipoCambioInput.value.trim()
            ? calcTipoCambioInput.value.trim()
            : '3.78';
    }

    function getTotalFinanciamientoCalculoValue() {
        const calcMontoFinanciarInput = document.getElementById('calcMontoFinanciar');
        const totalValue = calcMontoFinanciarInput ? calcMontoFinanciarInput.value.trim() : '';
        return totalValue && totalValue !== 'S/ 0.00' ? totalValue : 'S/ 21,480.00';
    }

    function getControlValue(id, fallback = '') {
        const control = document.getElementById(id);
        const value = control ? String(control.value || '').trim() : '';
        return value || fallback;
    }

    function getSelectTextValue(id, fallback = '') {
        const select = document.getElementById(id);
        if (!select) return fallback;
        const selectedOption = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        const text = selectedOption ? String(selectedOption.textContent || '').trim() : '';
        return text || getControlValue(id, fallback);
    }

    function getMonedaPrecioCalculoSymbol() {
        return getControlValue('calcMonedaPrecio', 'USD').toUpperCase() === 'PEN' ? 'S/' : '$';
    }

    function getCalculoMoneyValue(id, currency = '$') {
        return formatMoneyValue(parseMoneyValue(getControlValue(id, '0')), currency);
    }

    function normalizeSiNoForSolicitud(value, uppercase = false) {
        const normalized = String(value || '').trim().toUpperCase();
        const isSi = normalized === 'SI' || normalized === 'SÍ' || normalized === 'SÍ' || normalized === 'YES' || normalized === 'TRUE';
        return uppercase ? (isSi ? 'SI' : 'NO') : (isSi ? 'Si' : 'No');
    }

    function getPlanGpsSolicitudDesdeCalculo() {
        const gpsSeleccionado = String(getControlValue('calcGps', 'SI') || '').trim().toUpperCase();
        return gpsSeleccionado === 'NO' ? 'Ninguno' : 'Premium';
    }

    function getCalculoSolicitudData() {
        const monedaPrecio = getMonedaPrecioCalculoSymbol();
        const plazoMeses = getControlValue('calcPlazoSeleccionado', '24');
        const cuotasDobles = normalizeSiNoForSolicitud(getControlValue('calcCuotasDobles', 'No'));
        const mesesCuotasDobles = cuotasDobles === 'Si'
            ? getControlValue('calcMesesCuotasDobles', 'Agosto / Enero')
            : '';

        return {
            tipoCambio: getTipoCambioCalculoValue(),
            precioVehiculo: getCalculoMoneyValue('calcPrecioUsd', monedaPrecio),
            cuotaInicial: getCalculoMoneyValue('calcCuotaInicial', monedaPrecio),
            plazoSeleccionado: `${plazoMeses} meses`,
            diaPago: getControlValue('calcDiaPago', '03'),
            totalFinanciamiento: getTotalFinanciamientoCalculoValue(),
            gastosNotariales: normalizeSiNoForSolicitud(getControlValue('calcNotarial', 'SI'), true),
            gastosRegistrales: normalizeSiNoForSolicitud(getControlValue('calcRegistral', 'SI'), true),
            gastosDelivery: normalizeSiNoForSolicitud(getControlValue('calcTomaFirmas', 'SI'), true),
            incluirPortes: normalizeSiNoForSolicitud(getControlValue('calcPortes', 'NO')),
            cuotasDobles,
            mesesCuotasDobles,
            costoGps: getCalculoMoneyValue('calcCostoGps', '$'),
            planGps: getPlanGpsSolicitudDesdeCalculo(),
            seguroVehicular: getSeguroVehicularCalculoValue(),
            costoSeguroVehicular: getCostoSeguroVehicularCalculoValue(),
            seguroDesgravamen: getSeguroDesgravamenCalculoValue(),
            tipoSeguroDesgravamen: getTipoSeguroDesgravamenCalculoValue()
        };
    }

    function getSeguroVehicularCalculoValue() {
        return getSelectTextValue('calcTipoSeguroVehicular', 'Con seguro');
    }

    function getCostoSeguroVehicularCalculoValue() {
        return formatearPorcentaje(getControlValue('calcPorcentajeSeguroVehicular', '0'));
    }

    function getSeguroDesgravamenCalculoValue() {
        const calcDesgravamen = document.getElementById('calcDesgravamen');
        if (!calcDesgravamen) return 'Con seguro';
        const selectedOption = calcDesgravamen.options && calcDesgravamen.selectedIndex >= 0
            ? calcDesgravamen.options[calcDesgravamen.selectedIndex]
            : null;
        return selectedOption ? String(selectedOption.textContent || '').trim() : 'Con seguro';
    }

    function getTipoSeguroDesgravamenCalculoValue() {
        const calcTipoSeguroDesgravamen = document.getElementById('calcTipoSeguroDesgravamen');
        const value = calcTipoSeguroDesgravamen ? String(calcTipoSeguroDesgravamen.value || '').trim() : '';
        return value || 'Individual';
    }

    function updateTipoSeguroDesgravamenCalculoVisibility() {
        const calcDesgravamen = document.getElementById('calcDesgravamen');
        const tipoGroup = document.getElementById('calcTipoSeguroDesgravamenGroup');
        const tipoSelect = document.getElementById('calcTipoSeguroDesgravamen');
        const desgravamenValue = String(calcDesgravamen?.value || '').trim().toUpperCase();
        const desgravamenText = String(calcDesgravamen?.options?.[calcDesgravamen?.selectedIndex]?.textContent || '').trim().toUpperCase();
        const habilitarTipo = desgravamenValue === 'SI' || desgravamenValue === 'CON_SEGURO' || desgravamenText === 'CON SEGURO';

        if (tipoGroup) {
            tipoGroup.classList.toggle('is-hidden', !habilitarTipo);
        }
        if (tipoSelect) {
            tipoSelect.disabled = !habilitarTipo;
            tipoSelect.classList.toggle('disabled', !habilitarTipo);
        }
    }

    function updateTipoSeguroDesgravamenSolicitudVisibility() {
        const regSegDesgravamen = document.getElementById('regSegDesgravamen');
        const tipoGroup = document.getElementById('regTipoSeguroDesgravamenGroup');
        const tipoSelect = document.getElementById('regSegDesgProd');
        const desgravamenValue = String(regSegDesgravamen?.value || '').trim().toUpperCase();
        const desgravamenText = String(regSegDesgravamen?.options?.[regSegDesgravamen?.selectedIndex]?.textContent || '').trim().toUpperCase();
        const habilitarTipo = desgravamenValue === 'SI' || desgravamenValue === 'CON_SEGURO' || desgravamenText === 'CON SEGURO';

        if (tipoGroup) {
            tipoGroup.classList.toggle('is-hidden', !habilitarTipo);
        }
        if (tipoSelect) {
            tipoSelect.disabled = !habilitarTipo;
            tipoSelect.classList.toggle('disabled', !habilitarTipo);
        }
    }

    function aplicarSegurosSolicitudDesdeCalculo(solicitud = null) {
        setRegistroFieldValue('regSegVehicular', solicitud?.seguroVehicular || getSeguroVehicularCalculoValue());
        setRegistroFieldValue('regSegVehCosto', solicitud?.costoSeguroVehicular || getCostoSeguroVehicularCalculoValue());
        setRegistroFieldValue('regSegDesgravamen', solicitud?.seguroDesgravamen || getSeguroDesgravamenCalculoValue());
        setRegistroFieldValue('regSegDesgProd', solicitud?.tipoSeguroDesgravamen || getTipoSeguroDesgravamenCalculoValue());
        updateTipoSeguroDesgravamenSolicitudVisibility();
    }

    function aplicarUbicacionSolicitud(concesionario, sucursal) {
        const ubicacion = getSimulacionUbicacion();
        setSelectValueByText('regVehConcesionario', concesionario || ubicacion.concesionario || 'Hyundai');
        setSelectValueByText('regVehTienda', sucursal || ubicacion.sucursal || 'Puruchuco');
    }

    function updateHeaderUbicacion() {
        if (!headerLocationText) return;
        const { concesionario, sucursal } = getSimulacionUbicacion();
        headerLocationText.textContent = `${concesionario} - ${sucursal}`;
    }

    function clearSimulacionUbicacionHighlight() {
        [simConcesionario, simSucursal].forEach(control => {
            if (!control) return;
            control.classList.remove('input-attention');
            const group = control.closest('.simulacion-header-field, .form-group');
            if (group) group.classList.remove('field-attention');
        });
    }

    function resaltarSimulacionUbicacion() {
        [simConcesionario, simSucursal].forEach(control => {
            if (!control) return;
            control.classList.remove('input-attention');
            void control.offsetWidth;
            control.classList.add('input-attention');
            const group = control.closest('.simulacion-header-field, .form-group');
            if (group) group.classList.add('field-attention');
        });
        if (simConcesionario) simConcesionario.focus();
    }

    [simConcesionario, simSucursal].forEach(control => {
        if (!control) return;
        control.addEventListener('change', () => {
            clearSimulacionUbicacionHighlight();
            updateHeaderUbicacion();
        });
    });
    updateHeaderUbicacion();

    function limpiarConfirmacionSimulacionCancelHandler() {
        const cancelBtn = document.getElementById('modalBtnCancel');
        if (cancelBtn && simulacionConfirmCancelHandler) {
            cancelBtn.removeEventListener('click', simulacionConfirmCancelHandler, true);
        }
        simulacionConfirmCancelHandler = null;
    }

    function mostrarConfirmacionSimulacion() {
        const { concesionario, sucursal } = getSimulacionUbicacion();
        clearSimulacionUbicacionHighlight();

        modalTitle.textContent = 'Confirmación';
        modalBody.innerHTML = `
            <div class="popup-confirmacion-simulacion">
                <div class="popup-confirmacion-icon">
                    <span class="material-icons-outlined">help_outline</span>
                </div>
                <p class="popup-confirmacion-text">
                    ¿Está seguro de realizar la simulación en el concesionario <strong>${concesionario}</strong> y la sucursal <strong>${sucursal}</strong>?
                </p>
            </div>
        `;

        const cancelBtn = document.getElementById('modalBtnCancel');
        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);

        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = 'Cancelar';
        newActionBtn.style.display = 'inline-flex';
        newActionBtn.textContent = 'Aceptar';

        limpiarConfirmacionSimulacionCancelHandler();
        simulacionConfirmCancelHandler = (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeModal();
            resaltarSimulacionUbicacion();
        };
        cancelBtn.addEventListener('click', simulacionConfirmCancelHandler, true);

        newActionBtn.addEventListener('click', () => {
            limpiarConfirmacionSimulacionCancelHandler();
            closeModal();
            showResultadoEvaluacion();
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Simular button — show confirmation before navigating to Resultado
    btnSimular.addEventListener('click', () => {
        if (btnSimular.disabled) {
            resaltarCamposFaltantesSimulacion();
            return;
        }
        mostrarConfirmacionSimulacion();
    });

    // ============================
    // RESULTADO — Show & Populate
    // ============================
    function showFlujoTab(tabName) {
        const targetId = tabName === 'calculo' ? 'tabCalculo' : 'tabResultado';
        document.querySelectorAll('.flujo-tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.flujo-tab-btn').forEach(btn => btn.classList.remove('active'));

        const targetTab = document.getElementById(targetId);
        const targetBtn = document.querySelector(`[data-target="${targetId}"]`);
        if (targetTab) targetTab.classList.add('active');
        if (targetBtn) targetBtn.classList.add('active');
        updateResultadoFixedHeader(tabName);
    }

    function getResultadoTextValue(elementId, fallback = '-') {
        const element = document.getElementById(elementId);
        if (!element) return fallback;
        return (element.value || element.textContent || '').trim() || fallback;
    }

    function updateResultadoFixedHeader(tabName) {
        const fixedHeader = document.querySelector('.resultado-fixed-header');
        if (!fixedHeader) return;

        const isCalculo = tabName === 'calculo';
        fixedHeader.classList.toggle('is-calculo', isCalculo);

        if (!isCalculo) return;

        const capacidadMaxima = document.getElementById('resFixedCapacidadMaxima');
        const inicialMinima = document.getElementById('resFixedInicialMinima');
        const segmento = document.getElementById('resFixedSegmento');

        if (capacidadMaxima) {
            capacidadMaxima.textContent = getResultadoTextValue('resCuotaMaxima', getResultadoTextValue('calcCuotaMaxima', 'S/ 0.00'));
        }
        if (inicialMinima) {
            inicialMinima.textContent = getResultadoTextValue('resInicialMinimaPorcentaje', '10%');
        }
        if (segmento) {
            segmento.textContent = getResultadoTextValue('resSegmentoRiesgo', '-');
        }
    }


    function setResultadoDocumento(tipoDoc, nroDoc) {
        const tipoDocEl = document.getElementById('resTipoDoc');
        const nroDocEl = document.getElementById('resNroDoc');
        if (tipoDocEl) {
            if ('value' in tipoDocEl) tipoDocEl.value = tipoDoc;
            tipoDocEl.textContent = tipoDoc;
        }
        if (nroDocEl) {
            if ('value' in nroDocEl) nroDocEl.value = nroDoc;
            nroDocEl.textContent = nroDoc;
        }
    }

    function getResultadoDocumento() {
        const tipoDocEl = document.getElementById('resTipoDoc');
        const nroDocEl = document.getElementById('resNroDoc');
        return {
            tipoDoc: tipoDocEl ? (tipoDocEl.value || tipoDocEl.textContent || '').trim() : '',
            nroDoc: nroDocEl ? (nroDocEl.value || nroDocEl.textContent || '').trim() : ''
        };
    }

    function syncIngresoEstimadoCalculo() {
        const resIngresoEstimado = document.getElementById('resIngresoEstimado');
        const calcIngresoEstimado = document.getElementById('calcIngresoEstimado');
        if (resIngresoEstimado && calcIngresoEstimado) {
            calcIngresoEstimado.value = resIngresoEstimado.textContent;
        }
    }

    function syncTelefonoPoliticasCalculo() {
        if (calcTelefonoPoliticas) {
            calcTelefonoPoliticas.value = nroTelefono.value.trim();
            calcTelefonoPoliticas.setCustomValidity('');
            if (calcTelefonoPoliticas.value.trim()) {
                clearTelefonoPoliticasHighlight();
            }
        }
        updateContinuarDesdeCalculoState();
    }

    function getTelefonoPoliticasCalculo() {
        return calcTelefonoPoliticas ? calcTelefonoPoliticas.value.trim() : nroTelefono.value.trim();
    }

    function validarTelefonoPoliticasCalculo() {
        if (!calcTelefonoPoliticas) return true;
        calcTelefonoPoliticas.setCustomValidity('');
        clearTelefonoPoliticasHighlight();
        return true;
    }

    function clearTelefonoPoliticasHighlight() {
        if (!calcTelefonoPoliticas) return;
        calcTelefonoPoliticas.classList.remove('input-attention');
        const group = calcTelefonoPoliticas.closest('.form-group');
        if (group) group.classList.remove('field-attention');
    }

    function resaltarTelefonoPoliticasCalculo() {
        clearTelefonoPoliticasHighlight();
    }

    function tieneFilaCalculoSeleccionada() {
        return !!document.querySelector('#calcCuotasBody tr.selected');
    }

    function updateContinuarDesdeCalculoState() {
        const btnContinuarCalculo = document.getElementById('btnContinuarDesdeCalculo');
        if (!btnContinuarCalculo) return;
        const debeHabilitar = tieneFilaCalculoSeleccionada() && !resultadoActionsLockedByStage;
        btnContinuarCalculo.disabled = resultadoActionsLockedByStage;
        btnContinuarCalculo.classList.toggle('is-disabled', !debeHabilitar);
        btnContinuarCalculo.setAttribute('aria-disabled', String(!debeHabilitar));
    }

    function puedeContinuarDesdeCalculo() {
        return tieneFilaCalculoSeleccionada();
    }

    function getConyugeSimulacionData() {
        const tipoDocConyugeEl = document.getElementById('tipoDocConyuge');
        const nroDocConyugeEl = document.getElementById('nroDocConyuge');
        const nroDocConyugeValue = nroDocConyugeEl ? nroDocConyugeEl.value.trim() : '';
        return {
            tieneConyuge: toggleConyuge.checked && nroDocConyugeValue !== '',
            tipoDoc: tipoDocConyugeEl ? tipoDocConyugeEl.value : 'DNI',
            nroDoc: nroDocConyugeValue
        };
    }

    function actualizarConyugeResultado() {
        const conyuge = getConyugeSimulacionData();
        const resConyugeCard = document.getElementById('resConyugeCard');
        const resTipoDocConyuge = document.getElementById('resTipoDocConyuge');
        const resNroDocConyuge = document.getElementById('resNroDocConyuge');
        if (!resConyugeCard) return;

        if (conyuge.tieneConyuge) {
            if (resTipoDocConyuge) resTipoDocConyuge.value = conyuge.tipoDoc;
            if (resNroDocConyuge) resNroDocConyuge.value = conyuge.nroDoc;
            resConyugeCard.style.display = 'block';
        } else {
            if (resTipoDocConyuge) resTipoDocConyuge.value = 'DNI';
            if (resNroDocConyuge) resNroDocConyuge.value = '';
            resConyugeCard.style.display = 'none';
        }
    }

    function setEstadoCivilCasadoDesdeConyuge() {
        const regEstadoCivilEl = document.getElementById('regEstadoCivil');
        if (!regEstadoCivilEl) return;
        regEstadoCivilEl.value = 'CASADO';
        regEstadoCivilEl.dispatchEvent(new Event('change'));
    }

    function limpiarConyugeSolicitud() {
        const regConyugeCard = document.getElementById('regConyugeCard');
        if (regConyugeCard) regConyugeCard.style.display = 'none';
        ['regConTipoDoc', 'regConNroDoc', 'regConApePaterno', 'regConApeMaterno', 'regConFechaNac', 'regConNacionalidad'].forEach(id => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });
    }

    function aplicarConyugeSolicitud(conyuge) {
        const regConyugeCard = document.getElementById('regConyugeCard');
        if (!regConyugeCard) return;

        const tieneConyugeSolicitud = !!(conyuge && conyuge.nroDoc);
        if (!tieneConyugeSolicitud) {
            limpiarConyugeSolicitud();
            return;
        }

        regConyugeCard.style.display = 'block';
        const regConTipoDoc = document.getElementById('regConTipoDoc');
        const regConNroDoc = document.getElementById('regConNroDoc');
        const regConApePaterno = document.getElementById('regConApePaterno');
        const regConApeMaterno = document.getElementById('regConApeMaterno');
        const regConFechaNac = document.getElementById('regConFechaNac');
        const regConNacionalidad = document.getElementById('regConNacionalidad');

        if (regConTipoDoc) regConTipoDoc.value = conyuge.tipoDoc || 'DNI';
        if (regConNroDoc) regConNroDoc.value = conyuge.nroDoc || '';
        if (regConApePaterno) regConApePaterno.value = conyuge.apellidoPaterno || '';
        if (regConApeMaterno) regConApeMaterno.value = conyuge.apellidoMaterno || '';
        if (regConFechaNac) regConFechaNac.value = conyuge.fechaNacimiento || '';
        if (regConNacionalidad) regConNacionalidad.value = conyuge.nacionalidad || '';

        setEstadoCivilCasadoDesdeConyuge();
    }

    function aplicarConyugeSolicitudDesdeSimulacion(solicitud) {
        const conyugeSimulacion = getConyugeSimulacionData();
        if (conyugeSimulacion.tieneConyuge) {
            const conyugeSolicitud = {
                tipoDoc: conyugeSimulacion.tipoDoc,
                nroDoc: conyugeSimulacion.nroDoc,
                apellidoPaterno: solicitud?.conyuge?.apellidoPaterno || '',
                apellidoMaterno: solicitud?.conyuge?.apellidoMaterno || '',
                fechaNacimiento: solicitud?.conyuge?.fechaNacimiento || '',
                nacionalidad: solicitud?.conyuge?.nacionalidad || ''
            };
            if (solicitud) solicitud.conyuge = conyugeSolicitud;
            aplicarConyugeSolicitud(conyugeSolicitud);
        } else {
            if (solicitud) solicitud.conyuge = null;
            limpiarConyugeSolicitud();
        }
    }

    document.querySelectorAll('.flujo-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const esCalculo = btn.dataset.target === 'tabCalculo';
            showFlujoTab(esCalculo ? 'calculo' : 'resultado');
            if (esCalculo) {
                syncTelefonoPoliticasCalculo();
                syncPrecioVehiculoSimulacionCalculo();
            }
            refrescarBaselineGuardiaCambiosStageSimulacion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    function showResultadoEvaluacion() {
        // Gather form data
        const tipoDoc = tipoDocumento.value;
        const nroDoc = nroDocumento.value.trim();

        // Generate mock solicitud ID: EJE + [AÑO] + [correlativo] (ej. EJE2026001)
        const now = new Date();
        const year = now.getFullYear();
        const formattedCorrelativo = String(correlativoCounter++).padStart(3, '0');
        const solicitudId = `EJE${year}${formattedCorrelativo}`;
        currentSolicitudId = solicitudId; // Save in global variable
        desactivarGuardiaCambiosStageSimulacion();

        // Generate timestamp for mock data received (dd-mm-yyyy hh:mm:ss)
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const fechaStr = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;

        // Concesionario y sucursal seleccionados en Datos de simulación
        const { concesionario: headerConcesionario, sucursal: headerTienda } = getSimulacionUbicacion();

        // Generate mock financial data based on document
        const mockData = generateMockEvaluacion(nroDoc);

        // Immediately add to solicitudes array as SIMULACIÓN / PENDIENTE
        const newSimSol = {
            id: solicitudId,
            cliente: 'Juan Pérez García', // mock client name
            documento: `${tipoDoc} - ${nroDoc}`,
            tipoCredito: 'Crédito vehicular',
            monto: `S/ ${mockData.montoPreaprobado}`,
            fecha: fechaStr,
            concesionario: headerConcesionario,
            tienda: headerTienda,
            etapa: 'SIMULACIÓN',
            estado: 'PENDIENTE',
            telefono: nroTelefono.value.trim() || '922159933',
            precioVehiculoUsd: formatearDecimalConMiles(simPrecioVehiculoUsd?.value || '0'),
            habilitarNavegacionEtapas: true
        };
        solicitudes.unshift(newSimSol);
        stageNavigationEnabledForCurrentFlow = true;

        // Populate the resultado view
        document.getElementById('resSolicitudId').textContent = solicitudId;
        document.getElementById('resFechaHora').textContent = `${fechaStr}`; // show correct date & time
        setResultadoDocumento(tipoDoc, nroDoc);
        actualizarConyugeResultado();
        document.getElementById('resMontoPreaprobado').textContent = `S/ ${mockData.montoPreaprobado}`;
        document.getElementById('resCalificacion').textContent = mockData.califica ? 'CALIFICA' : 'NO CALIFICA';
        document.getElementById('resCalificacionMsg').textContent = mockData.califica
            ? 'El cliente cumple con los criterios de evaluación.'
            : 'El cliente no cumple con los criterios de evaluación.';
        document.getElementById('resSegmentoRiesgo').textContent = mockData.segmentoRiesgo;
        document.getElementById('resIngresoEstimado').textContent = `S/ ${mockData.ingresoEstimado}`;
        syncIngresoEstimadoCalculo();
        document.getElementById('resCuotaMaxima').textContent = `S/ ${mockData.capacidadCuotaMaxima}`;
        const calcCuotaMaxima = document.getElementById('calcCuotaMaxima');
        if (calcCuotaMaxima) calcCuotaMaxima.value = `S/ ${mockData.capacidadCuotaMaxima}`;
        syncPrecioVehiculoSimulacionCalculo();
        const calcIngresoDeclaradoInicial = document.getElementById('calcIngresoDeclarado');
        if (calcIngresoDeclaradoInicial) calcIngresoDeclaradoInicial.value = '';
        if (typeof updateCalcCasoPilotoState === 'function') updateCalcCasoPilotoState();

        // Update califica styling
        const calificacionCard = document.querySelector('.resultado-calificacion');
        const calificacionIcon = calificacionCard.querySelector('.resultado-calificacion-icon .material-icons-outlined');
        if (mockData.califica) {
            calificacionCard.classList.add('califica');
            calificacionCard.classList.remove('no-califica');
            calificacionIcon.textContent = 'check_circle';
        } else {
            calificacionCard.classList.remove('califica');
            calificacionCard.classList.add('no-califica');
            calificacionIcon.textContent = 'cancel';
        }

        // Switch views: hide all, show resultado
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloResultado').classList.add('active');
        applyResultadoReadOnlyState(false, newSimSol);
        renderStageNavigation('resultadoStageTabs', newSimSol.etapa, newSimSol.estado);
        showFlujoTab('resultado');

        // Update sidebar active state
        navItems.forEach(n => n.classList.remove('active'));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        showToast('Simulación procesada y registrada en bandeja.', 'success');
        mostrarPopupSolicitudGenerada(solicitudId);
    }

    function mostrarPopupSolicitudGenerada(solicitudId) {
        modalTitle.textContent = 'Solicitud generada con éxito';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-solicitud-text">La simulación fue procesada correctamente.</p>
                <div class="popup-solicitud-number">
                    <span>N° de solicitud</span>
                    <strong>${solicitudId}</strong>
                </div>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function generateMockEvaluacion(nroDoc) {
        // Use document number to seed pseudo-random consistent results
        const seed = nroDoc.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

        const montos = ['150,000.00', '200,000.00', '250,000.00', '300,000.00', '350,000.00', '85,000.00', '120,000.00'];
        const segmentos = ['NORMAL', 'REGULAR', 'PREFERENTE', 'BAJO'];
        const ingresos = ['3,500.00', '4,200.00', '5,850.00', '7,200.00', '8,500.00', '6,100.00'];
        const ingresosDeclarados = ['4,000.00', '5,000.00', '6,000.00', '7,500.00', '8,000.00', '10,000.00'];
        const montoPreaprobado = montos[seed % montos.length];
        const ingresoEstimado = ingresos[seed % ingresos.length];
        const capacidadCuotaMaxima = calcularCapacidadCuotaMaxima(
            parseMoneyValue(montoPreaprobado),
            parseMoneyValue(ingresoEstimado),
            60,
            0.128
        ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return {
            montoPreaprobado,
            califica: seed % 5 !== 0, // ~80% califica
            segmentoRiesgo: segmentos[seed % segmentos.length],
            ingresoEstimado,
            capacidadCuotaMaxima,
            ingresoDeclarado: ingresosDeclarados[seed % ingresosDeclarados.length]
        };
    }

    // Regresar button — go back to simulación form
    document.getElementById('btnRegresar').addEventListener('click', () => {
        desactivarGuardiaCambiosStageSimulacion();
        stageNavigationEnabledForCurrentFlow = false;
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloSimulacion').classList.add('active');

        // Restore sidebar active
        navItems.forEach(n => n.classList.remove('active'));
        document.getElementById('navSimulacion').classList.add('active');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Siguiente desde Resultado — muestra la pestaña Cálculo dentro de la misma sección
    document.getElementById('btnContinuarSolicitud').addEventListener('click', () => {
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloResultado').classList.add('active');
        showFlujoTab('calculo');
        const calcCuotaMaxima = document.getElementById('calcCuotaMaxima');
        const resCuotaMaxima = document.getElementById('resCuotaMaxima');
        if (calcCuotaMaxima && resCuotaMaxima) calcCuotaMaxima.value = resCuotaMaxima.textContent;
        syncIngresoEstimadoCalculo();
        syncTelefonoPoliticasCalculo();
        syncPrecioVehiculoSimulacionCalculo();
        document.getElementById('calcResultadoCard').style.display = 'none';
        document.querySelectorAll('#calcCuotasBody tr').forEach(r => r.classList.remove('selected'));
        limpiarPoliticasCalculoSinSeleccion();
        updateContinuarDesdeCalculoState();
        refrescarBaselineGuardiaCambiosStageSimulacion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function continuarARegistroSolicitud() {
        desactivarGuardiaCambiosStageSimulacion();
        const idSolicitud = document.getElementById('resSolicitudId').textContent;
        const { tipoDoc, nroDoc } = getResultadoDocumento();

        // Update stage to SOLICITUD and status to PENDIENTE in solicitudes
        const currentSol = solicitudes.find(s => s.id === idSolicitud);
        const carreteraActual = getCarreteraActual();
        const calculoSolicitudData = getCalculoSolicitudData();
        if (currentSol) {
            currentSol.etapa = 'SOLICITUD';
            currentSol.estado = 'PENDIENTE';
            currentSol.cartera = carreteraActual;
            currentSol.tipoCambio = calculoSolicitudData.tipoCambio;
            currentSol.precioVehiculo = calculoSolicitudData.precioVehiculo;
            currentSol.cuotaInicial = calculoSolicitudData.cuotaInicial;
            currentSol.plazoSeleccionado = calculoSolicitudData.plazoSeleccionado;
            currentSol.diaPago = calculoSolicitudData.diaPago;
            currentSol.totalFinanciamiento = calculoSolicitudData.totalFinanciamiento;
            currentSol.gastosNotariales = calculoSolicitudData.gastosNotariales;
            currentSol.gastosRegistrales = calculoSolicitudData.gastosRegistrales;
            currentSol.gastosDelivery = calculoSolicitudData.gastosDelivery;
            currentSol.incluirPortes = calculoSolicitudData.incluirPortes;
            currentSol.cuotasDobles = calculoSolicitudData.cuotasDobles;
            currentSol.mesesCuotasDobles = calculoSolicitudData.mesesCuotasDobles;
            currentSol.gastosInclGps = calculoSolicitudData.costoGps;
            currentSol.planGps = calculoSolicitudData.planGps;
            currentSol.seguroVehicular = calculoSolicitudData.seguroVehicular;
            currentSol.costoSeguroVehicular = calculoSolicitudData.costoSeguroVehicular;
            currentSol.seguroDesgravamen = calculoSolicitudData.seguroDesgravamen;
            currentSol.tipoSeguroDesgravamen = calculoSolicitudData.tipoSeguroDesgravamen;
        }

        // Set top header info bar
        document.getElementById('regSolicitudId').textContent = idSolicitud;
        const regCarteraEl = document.getElementById('regCartera');
        if (regCarteraEl) {
            regCarteraEl.textContent = carreteraActual;
            aplicarEstiloCarretera(regCarteraEl, carreteraActual);
        }
        document.getElementById('regFechaSimulacion').textContent = currentSol?.fecha || document.getElementById('resFechaHora')?.textContent || '-';
        document.getElementById('regUsuario').textContent = "ALOCHA";
        actualizarEstadoRegistroResumen(currentSol || { etapa: 'SOLICITUD', estado: 'PENDIENTE', fecha: document.getElementById('regFechaSimulacion')?.textContent || '-' });

        // Set pre-populated fields for Datos Cliente
        document.getElementById('regTipoDoc').value = tipoDoc;
        document.getElementById('regNroDoc').value = nroDoc;
        document.getElementById('regNombres').value = "Juan";
        document.getElementById('regApePaterno').value = "Pérez";
        document.getElementById('regApeMaterno').value = "García";
        document.getElementById('regFechaNac').value = "11/05/1995";
        document.getElementById('regCelular').value = getTelefonoPoliticasCalculo() || nroTelefono.value || "";
        document.getElementById('regCorreo').value = "";
        
        // Reset inputs that are editable
        document.getElementById('regSexo').value = "";
        document.getElementById('regNacionalidad').value = "";
        document.getElementById('regResidencia').value = "";
        document.getElementById('regDireccion').value = "";
        document.getElementById('regDepartamento').value = "";
        document.getElementById('regProvincia').innerHTML = '<option value="" disabled selected>Seleccionar</option>';
        document.getElementById('regDistrito').innerHTML = '<option value="" disabled selected>Seleccionar</option>';
        document.getElementById('regEstadoCivil').value = "";
        const regMancomunaIngresosReset = document.getElementById('regMancomunaIngresos');
        if (regMancomunaIngresosReset) regMancomunaIngresosReset.value = "";
        actualizarVisibilidadMancomunaIngresos();
        actualizarVisibilidadSeparacionBienes();
        aplicarConyugeSolicitudDesdeSimulacion(currentSol);

        // Reset Datos Laborales
        document.getElementById('regCatLaboral').value = "";
        document.getElementById('regRucEmpleador').value = "";
        document.getElementById('regNombreCentroLaboral').value = "";
        document.getElementById('regDireccionLaboral').value = "";
        document.getElementById('regGiroActividad').value = "";
        document.getElementById('regCargo').value = "";
        document.getElementById('regFechaIngresoLab').value = "";
        document.getElementById('regMonedaIngreso').value = "PEN";
        document.getElementById('regIngresoNeto').value = "S/ 0.00";
        resetIngresosSection();
        resetIngresosSection('conyuge');
        actualizarVisibilidadIngresosSolicitud(carreteraActual);

        // Pre-populate Vehiculo
        document.getElementById('regVehEstado').value = "Nuevo";
        aplicarUbicacionSolicitud(currentSol?.concesionario, currentSol?.tienda);
        document.getElementById('regVehTipoDocVendedor').value = currentSol?.vendedorTipoDoc || "DNI";
        document.getElementById('regVehNroDocVendedor').value = currentSol?.vendedorNroDoc || "";
        document.getElementById('regVehVendedor').value = currentSol?.vendedor || "ALOCHA";
        document.getElementById('regVehMarca').value = "Toyota";
        document.getElementById('regVehModelo').value = "Corolla";
        document.getElementById('regVehAnio').value = "2026";
        document.getElementById('regVehTarjetaNombre').value = "TITULAR";
        actualizarDatosTerceroPropiedad(true);

        // Pre-populate Simulación con los valores ingresados en Cálculo
        setRegistroFieldValue('regSimProducto', "Credito Vehicular");
        setRegistroFieldValue('regSimCampana', "SUV Mayo 2026");
        setRegistroFieldValue('regSimMoneda', "Soles (S/.)");
        setRegistroFieldValue('regSimTipoCambio', calculoSolicitudData.tipoCambio);
        setRegistroFieldValue('regSimPrecioVeh', calculoSolicitudData.precioVehiculo);
        setRegistroFieldValue('regSimCuotaInicial', calculoSolicitudData.cuotaInicial);
        setRegistroFieldValue('regSimTea', "12.80%");
        setRegistroFieldValue('regSimPlazo', calculoSolicitudData.plazoSeleccionado);
        setRegistroFieldValue('regSimDiaPago', calculoSolicitudData.diaPago);
        setRegistroFieldValue('regTotalFinanciamiento', calculoSolicitudData.totalFinanciamiento);

        // Pre-populate Gastos con los valores ingresados en Cálculo
        setRegistroFieldValue('regGastosNotariales', calculoSolicitudData.gastosNotariales);
        setRegistroFieldValue('regGastosRegistrales', calculoSolicitudData.gastosRegistrales);
        setRegistroFieldValue('regGastosDelivery', calculoSolicitudData.gastosDelivery);
        setRegistroFieldValue('regPlanGpx', calculoSolicitudData.planGps);
        setRegistroFieldValue('regGastosInclGpx', calculoSolicitudData.costoGps);
        setRegistroFieldValue('regCuotasDobles', calculoSolicitudData.cuotasDobles);
        setRegistroFieldValue('regMesesCuotasDobles', calculoSolicitudData.mesesCuotasDobles);
        actualizarVisibilidadMesesCuotasDoblesSolicitud();
        setRegistroFieldValue('regIncluirPortes', calculoSolicitudData.incluirPortes);

        // Pre-populate Seguros con los valores ingresados en Cálculo
        aplicarSegurosSolicitudDesdeCalculo(currentSol);

        if (currentSol) {
            currentSol.registroEditableData = collectRegistroEditableData();
        }

        // Reset Checklist state & Read-Only state
        applyRegistrationFormReadOnlyState(false);
        lockDatosClienteYConyugeRiesgosObservado(currentSol || { etapa: 'SOLICITUD', estado: 'PENDIENTE' });
        lockEstadoVehiculoNuevo();
        applySolicitudPreviousScreenFieldsLock(currentSol || { etapa: 'SOLICITUD', estado: 'PENDIENTE' });
        attachedDocs = [];
        renderChecklistTable();
        actualizarChecklistPorCarretera(carreteraActual);
        actualizarVisibilidadIngresosSolicitud(carreteraActual);
        resetChecklistManualChecks();
        document.getElementById('regComentarios').value = "";
        toggleRegistroComentariosCards(false);

        // Navigate to Registro screen
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloRegistroSolicitud').classList.add('active');
        syncRegistroStickyClientFields();
        setTimeout(updateRegistroStickyClientBar, 0);
        window.scrollTo({ top: 0, behavior: 'smooth' });

    }

    function continuarDesdeCalculoASolicitud() {
        if (resultadoActionsLockedByStage) return;
        if (!puedeContinuarDesdeCalculo()) {
            clearTelefonoPoliticasHighlight();
            updateContinuarDesdeCalculoState();
            showToast('Selecciona una fila de la grilla para continuar con la solicitud.', 'warning');
            return;
        }
        validarTelefonoPoliticasCalculo();
        continuarARegistroSolicitud();
    }

    document.getElementById('btnContinuarDesdeCalculo').addEventListener('click', continuarDesdeCalculoASolicitud);
    updateContinuarDesdeCalculoState();

    document.getElementById('btnRegresarCalculo').addEventListener('click', () => {
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloResultado').classList.add('active');
        showFlujoTab('resultado');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function parseMoneyValue(value) {
        return Number(String(value || '0').replace(/[^0-9.,-]/g, '').replace(/,/g, '')) || 0;
    }

    function formatMoneyValue(value, currency = 'S/') {
        return `${currency} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function normalizarCarretera(carretera) {
        const tipo = String(carretera || 'EXPRESS')
            .replace('CARTERA:', '')
            .trim()
            .toUpperCase();
        return ['EXPRESS', 'ESCRITORIO', 'SEMIFULL', 'FULL'].includes(tipo) ? tipo : 'EXPRESS';
    }

    function aplicarEstiloCarretera(element, carretera) {
        if (!element) return;
        const tipo = normalizarCarretera(carretera || element.textContent);
        element.classList.remove('carretera-express', 'carretera-escritorio', 'carretera-semifull', 'carretera-full', 'tag-express', 'tag-full');
        element.classList.add('carretera-badge', `carretera-${tipo.toLowerCase()}`);
    }

    function getReglasCarretera(carretera) {
        const tipo = normalizarCarretera(carretera);
        if (tipo === 'FULL') {
            return {
                carretera: 'FULL',
                documentos: ['Copia de DNI ambas caras.', 'Recibo de servicios.', 'Cotización del vehículo.'],
                verificacion: 'Verificación domiciliaria'
            };
        }

        return {
            carretera: tipo,
            documentos: ['Copia de DNI ambas caras.'],
            verificacion: 'No aplica'
        };
    }

    function renderPolicyItems(items) {
        if (!items || items.length <= 1) return items && items[0] ? items[0] : '';
        return `<ul class="policy-list">${items.map(item => `<li>${item}</li>`).join('')}</ul>`;
    }

    function actualizarPoliticasPorCarretera(carretera) {
        const reglas = getReglasCarretera(carretera);
        currentCarretera = reglas.carretera;

        const calcCarretera = document.getElementById('calcCarretera');
        const calcDocumentos = document.getElementById('calcDocumentos');
        const calcVerificacion = document.getElementById('calcVerificacion');

        if (calcCarretera) {
            calcCarretera.textContent = reglas.carretera;
            aplicarEstiloCarretera(calcCarretera, reglas.carretera);
        }
        if (calcDocumentos) calcDocumentos.innerHTML = renderPolicyItems(reglas.documentos);
        if (calcVerificacion) calcVerificacion.textContent = reglas.verificacion;

        return reglas;
    }

    function limpiarPoliticasCalculoSinSeleccion() {
        const calcCarretera = document.getElementById('calcCarretera');
        const calcDocumentos = document.getElementById('calcDocumentos');
        const calcVerificacion = document.getElementById('calcVerificacion');

        if (calcCarretera) {
            calcCarretera.textContent = '-';
            calcCarretera.classList.remove(
                'carretera-badge',
                'carretera-express',
                'carretera-escritorio',
                'carretera-semifull',
                'carretera-full',
                'tag-express',
                'tag-full'
            );
        }
        if (calcDocumentos) calcDocumentos.textContent = '-';
        if (calcVerificacion) calcVerificacion.textContent = '-';
    }

    function actualizarCarreteraPorCapacidadSeleccionada(filaSeleccionada, carreteraBase = 'EXPRESS') {
        if (!filaSeleccionada) {
            limpiarPoliticasCalculoSinSeleccion();
            return null;
        }
        const cumpleCapacidad = filaSeleccionada?.dataset?.capacidadCumple === 'SI';
        const carreteraBaseNormalizada = normalizarCarretera(filaSeleccionada?.dataset?.carreteraBase || carreteraBase);
        const carreteraResultado = carreteraBaseNormalizada === 'FULL' ? 'FULL' : (cumpleCapacidad ? 'EXPRESS' : 'FULL');
        return actualizarPoliticasPorCarretera(carreteraResultado);
    }

    function getCarreteraActual() {
        const calcCarretera = document.getElementById('calcCarretera');
        return normalizarCarretera(calcCarretera?.textContent || currentCarretera || 'EXPRESS');
    }

    function esEstadoCivilConIngresosConyuge(estadoCivil = null) {
        const estado = String(estadoCivil ?? document.getElementById('regEstadoCivil')?.value ?? '')
            .trim()
            .toUpperCase();
        return estado === 'CASADO' || estado === 'CONVIVIENTE';
    }

    function esMancomunaIngresosSi() {
        const valorMancomuna = String(document.getElementById('regMancomunaIngresos')?.value || '')
            .trim()
            .toUpperCase();
        return valorMancomuna === 'SI';
    }

    function actualizarVisibilidadMancomunaIngresos() {
        const mancomunaGroup = document.getElementById('regMancomunaIngresosGroup');
        const mancomunaSelect = document.getElementById('regMancomunaIngresos');
        if (!mancomunaGroup) return;

        const mostrarMancomuna = esEstadoCivilConIngresosConyuge();
        mancomunaGroup.style.display = mostrarMancomuna ? '' : 'none';
        mancomunaGroup.hidden = !mostrarMancomuna;
        if (!mostrarMancomuna && mancomunaSelect) {
            mancomunaSelect.value = '';
        }
    }

    function actualizarVisibilidadIngresosSolicitud(carretera = null) {
        const ingresosCard = document.getElementById('ingresosCard');
        const ingresosConyugeCard = document.getElementById('ingresosConyugeCard');

        const carreteraSolicitud = normalizarCarretera(
            carretera || document.getElementById('regCartera')?.textContent || currentCarretera || 'EXPRESS'
        );
        const mostrarIngresos = carreteraSolicitud === 'FULL';
        const mostrarIngresosConyuge = mostrarIngresos && esEstadoCivilConIngresosConyuge() && esMancomunaIngresosSi();

        if (ingresosCard) {
            ingresosCard.style.display = mostrarIngresos ? '' : 'none';
            ingresosCard.hidden = !mostrarIngresos;
        }

        if (ingresosConyugeCard) {
            ingresosConyugeCard.style.display = mostrarIngresosConyuge ? '' : 'none';
            ingresosConyugeCard.hidden = !mostrarIngresosConyuge;
        }

        updateTotalIngresosCombinado();
    }

    limpiarPoliticasCalculoSinSeleccion();
    aplicarEstiloCarretera(document.getElementById('regCartera'), currentCarretera);
    actualizarVisibilidadMancomunaIngresos();
    // Se ejecuta al final de la inicialización, después de declarar INGRESOS_CONFIG,
    // para evitar detener la carga del JS antes de enlazar el botón Calcular.

    function actualizarChecklistPorCarretera(carretera) {
        const reglas = getReglasCarretera(carretera);
        const tag = document.getElementById('regChecklistCarteraTag');
        const desc = document.getElementById('regChecklistDesc');
        const reciboItem = document.getElementById('manualReciboItem');
        const cotizacionItem = document.getElementById('manualCotizacionItem');
        const chkRecibo = document.getElementById('chkManualRecibo');
        const chkCotizacion = document.getElementById('chkManualCotizacion');

        if (tag) {
            tag.textContent = `CARTERA: ${reglas.carretera}`;
            aplicarEstiloCarretera(tag, reglas.carretera);
        }

        if (desc) {
            desc.textContent = reglas.carretera === 'FULL'
                ? 'Para carretera FULL se requiere adjuntar copia de DNI ambas caras, recibo de servicios y cotización del vehículo.'
                : `Para carretera ${reglas.carretera} solo se requiere adjuntar copia de DNI ambas caras.`;
        }

        const esFull = reglas.carretera === 'FULL';
        if (reciboItem) reciboItem.style.display = esFull ? 'block' : 'none';
        if (cotizacionItem) cotizacionItem.style.display = esFull ? 'block' : 'none';
        if (!esFull) {
            if (chkRecibo) chkRecibo.checked = false;
            if (chkCotizacion) chkCotizacion.checked = false;
        }
    }

    function resetChecklistManualChecks() {
        ['chkManualDni', 'chkManualRecibo', 'chkManualCotizacion'].forEach(id => {
            const item = document.getElementById(id);
            if (item) item.checked = false;
        });
    }

    function getRequiredManualChecks(carretera) {
        const reglas = getReglasCarretera(carretera);
        const checks = [
            { id: 'chkManualDni', label: 'Copia de DNI ambas caras' }
        ];
        if (reglas.carretera === 'FULL') {
            checks.push(
                { id: 'chkManualRecibo', label: 'Recibo de servicios' },
                { id: 'chkManualCotizacion', label: 'Cotización del vehículo' }
            );
        }
        return checks;
    }

    function obtenerBaseIngresoCalculo() {
        const ingresoEstimado = parseMoneyValue(document.getElementById('calcIngresoEstimado').value);
        const ingresoDeclarado = parseMoneyValue(document.getElementById('calcIngresoDeclarado').value);
        const usaIngresoDeclarado = ingresoDeclarado > ingresoEstimado;
        const ingresoBase = usaIngresoDeclarado ? ingresoDeclarado : ingresoEstimado;

        return {
            ingresoEstimado,
            ingresoDeclarado,
            usaIngresoDeclarado,
            ingresoBase
        };
    }

    function calcularCuotaMensualMaxima(ingresoBase) {
        return ingresoBase * 0.35;
    }

    function calcularCuotaPorMonto(monto, plazoMeses, tea) {
        const tasaMensual = Math.pow(1 + tea, 1 / 12) - 1;
        if (tasaMensual > 0) {
            return monto * (tasaMensual * Math.pow(1 + tasaMensual, plazoMeses)) / (Math.pow(1 + tasaMensual, plazoMeses) - 1);
        }
        return monto / plazoMeses;
    }

    function calcularCapacidadCuotaMaxima(montoPreaprobado, ingresoBase, plazoMeses = 60, tea = 0.128) {
        const cuotaPorIngreso = calcularCuotaMensualMaxima(ingresoBase);
        const cuotaPorMontoPreaprobado = montoPreaprobado > 0
            ? calcularCuotaPorMonto(montoPreaprobado, plazoMeses, tea)
            : cuotaPorIngreso;

        return Math.min(cuotaPorIngreso, cuotaPorMontoPreaprobado);
    }

    function calcularFinanciamientoMaximo(ingresoBase, plazoMeses, tea) {
        const cuotaMensualMaxima = calcularCuotaMensualMaxima(ingresoBase);
        const tasaMensual = Math.pow(1 + tea, 1 / 12) - 1;

        if (tasaMensual > 0) {
            return cuotaMensualMaxima * (1 - Math.pow(1 + tasaMensual, -plazoMeses)) / tasaMensual;
        }

        return cuotaMensualMaxima * plazoMeses;
    }

    function actualizarCapacidadCuotaMaximaCalculo(mostrarToast = true) {
        const { ingresoBase } = obtenerBaseIngresoCalculo();
        const montoPreaprobado = parseMoneyValue(document.getElementById('resMontoPreaprobado').textContent);
        const cuotaMaxima = calcularCapacidadCuotaMaxima(montoPreaprobado, ingresoBase, 60, 0.128);
        const calcCapacidadCuotaMaxima = document.getElementById('calcCuotaMaxima');
        if (calcCapacidadCuotaMaxima) {
            calcCapacidadCuotaMaxima.value = formatMoneyValue(cuotaMaxima);
        }
        if (mostrarToast) {
            showToast(`Capacidad de cuota máxima calculada: ${formatMoneyValue(cuotaMaxima)}`, 'success');
        }
        return cuotaMaxima;
    }

    function ocultarResultadoCalculoPorCambioParametros() {
        const calcResultadoCard = document.getElementById('calcResultadoCard');
        const calcCuotasBody = document.getElementById('calcCuotasBody');
        if (!calcResultadoCard || !tieneFilaCalculoSeleccionada()) return;

        calcResultadoCard.style.display = 'none';
        if (calcCuotasBody) calcCuotasBody.innerHTML = '';
        limpiarPoliticasCalculoSinSeleccion();
        updateContinuarDesdeCalculoState();
    }

    function configurarOcultarResultadoCalculoAlCambiarParametros() {
        const calculoCard = document.querySelector('#tabCalculo .calculo-card');
        const tabCalculoContent = document.getElementById('tabCalculo');
        if (!calculoCard || !tabCalculoContent) return;

        const handler = (event) => {
            const control = event.target;
            if (!tabCalculoContent.classList.contains('active')) return;
            if (!control || !control.matches('input, select, textarea')) return;
            if (control.type === 'hidden' || control.readOnly || control.disabled) return;
            if (!tieneFilaCalculoSeleccionada()) return;

            ocultarResultadoCalculoPorCambioParametros();
        };

        calculoCard.addEventListener('input', handler, true);
        calculoCard.addEventListener('change', handler, true);
    }

    configurarOcultarResultadoCalculoAlCambiarParametros();

    function recalcularResultadoCalculo(mostrarToast = true) {
        validarCuotaInicialContraPrecio(false);
        const tea = parseMoneyValue(document.getElementById('calcTea').value) / 100;
        const precioUsd = parseMoneyValue(document.getElementById('calcPrecioUsd').value);
        const inicial = parseMoneyValue(document.getElementById('calcCuotaInicial').value);
        const tipoCambio = parseMoneyValue(document.getElementById('calcTipoCambio').value) || 1;
        const monedaCreditoEl = document.getElementById('calcMonedaCredito');
        const monedaPrecioEl = document.getElementById('calcMonedaPrecio');
        const monedaCredito = monedaCreditoEl ? monedaCreditoEl.value : 'PEN';
        const monedaPrecio = monedaPrecioEl ? monedaPrecioEl.value : 'USD';
        const currency = monedaCredito === 'USD' ? '$' : 'S/';
        const montoOperacion = monedaPrecio === 'USD' ? precioUsd * tipoCambio : precioUsd;
        const cuotaInicial = monedaPrecio === 'USD' ? inicial * tipoCambio : inicial;
        const montoFinanciar = Math.max(montoOperacion - cuotaInicial, 0);
        const calcMontoFinanciar = document.getElementById('calcMontoFinanciar');
        if (calcMontoFinanciar) calcMontoFinanciar.value = formatMoneyValue(montoFinanciar, 'S/');

        const { ingresoEstimado, ingresoDeclarado, ingresoBase } = obtenerBaseIngresoCalculo();
        const carreteraBaseCalculo = ingresoDeclarado > 0 ? 'FULL' : 'EXPRESS';
        const tasaMensual = Math.pow(1 + tea, 1 / 12) - 1;
        const plazoSeleccionado = parseInt(document.getElementById('calcPlazoSeleccionado').value, 10) || 24;
        const cuotaMensualMaxima = actualizarCapacidadCuotaMaximaCalculo(false);
        const plazos = [plazoSeleccionado];
        const tbody = document.getElementById('calcCuotasBody');
        tbody.innerHTML = '';

        plazos.forEach(plazo => {
            const cuota = tasaMensual > 0
                ? montoFinanciar * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1)
                : montoFinanciar / plazo;
            const cumple = cuota <= cuotaMensualMaxima;
            const tr = document.createElement('tr');
            tr.dataset.capacidadCumple = cumple ? 'SI' : 'NO';
            tr.dataset.carreteraBase = carreteraBaseCalculo;
            tr.innerHTML = `
                <td><strong>${plazo} meses</strong></td>
                <td>${(tea * 100).toFixed(2)}%</td>
                <td>${formatMoneyValue(cuota, currency)}</td>
                <td>${formatMoneyValue(cuotaMensualMaxima, 'S/').replace('S/ ', 'S/. ')}</td>
                <td><span class="capacidad-badge ${cumple ? 'ok' : 'warning'}">${cumple ? 'Cumple' : 'No cumple'}</span></td>
            `;
            tr.addEventListener('click', () => {
                document.querySelectorAll('#calcCuotasBody tr').forEach(row => row.classList.remove('selected'));
                tr.classList.add('selected');
                actualizarCarreteraPorCapacidadSeleccionada(tr, carreteraBaseCalculo);
                updateContinuarDesdeCalculoState();
            });
            tbody.appendChild(tr);
        });

        limpiarPoliticasCalculoSinSeleccion();
        document.getElementById('calcResultadoCard').style.display = 'block';
        updateContinuarDesdeCalculoState();
        if (mostrarToast) {
            showToast('Grilla de cuotas generada. Selecciona el plazo calculado para continuar.', 'success');
        }
    }

    document.getElementById('btnCalcularCuotas').addEventListener('click', () => {
        if (resultadoActionsLockedByStage) return;
        recalcularResultadoCalculo(true);
    });

    const calcIngresoDeclaradoInput = document.getElementById('calcIngresoDeclarado');
    const calcCasoPilotoCheckbox = document.getElementById('calcCasoPiloto');

    function updateCalcCasoPilotoState() {
        if (!calcIngresoDeclaradoInput || !calcCasoPilotoCheckbox) return;
        const tieneIngresoDeclarado = calcIngresoDeclaradoInput.value.trim() !== '';
        calcCasoPilotoCheckbox.disabled = !tieneIngresoDeclarado;
        if (!tieneIngresoDeclarado) {
            calcCasoPilotoCheckbox.checked = false;
        }
    }

    if (calcIngresoDeclaradoInput) {
        updateCalcCasoPilotoState();
    }

    function normalizarDecimalInput(value) {
        const rawValue = String(value || '').replace(/[^\d.,]/g, '');
        if (!rawValue) return '';

        const lastDotIndex = rawValue.lastIndexOf('.');
        const lastCommaIndex = rawValue.lastIndexOf(',');
        let decimalSeparatorIndex = -1;

        if (lastDotIndex !== -1 && lastCommaIndex !== -1) {
            decimalSeparatorIndex = Math.max(lastDotIndex, lastCommaIndex);
        } else if (lastDotIndex !== -1) {
            decimalSeparatorIndex = lastDotIndex;
        } else if (lastCommaIndex !== -1) {
            const decimalsCandidate = rawValue.slice(lastCommaIndex + 1).replace(/\D/g, '');
            decimalSeparatorIndex = decimalsCandidate.length > 0 && decimalsCandidate.length <= 2 ? lastCommaIndex : -1;
        }

        if (decimalSeparatorIndex !== -1) {
            const integerPart = rawValue.slice(0, decimalSeparatorIndex).replace(/\D/g, '');
            const decimalPart = rawValue.slice(decimalSeparatorIndex + 1).replace(/\D/g, '').slice(0, 2);
            return `${integerPart || '0'}.${decimalPart}`;
        }

        return rawValue.replace(/\D/g, '');
    }

    function formatearDecimal(value) {
        const parsedValue = Number.parseFloat(normalizarDecimalInput(value));
        return Number.isFinite(parsedValue) ? parsedValue.toFixed(2) : '0.00';
    }

    function formatearDecimalConMiles(value) {
        const parsedValue = Number.parseFloat(normalizarDecimalInput(value));
        return Number.isFinite(parsedValue)
            ? parsedValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '0.00';
    }

    function formatearPorcentaje(value) {
        return `${formatearDecimal(value)}%`;
    }

    function actualizarPorcentajeCuotaInicial() {
        const precioInput = document.getElementById('calcPrecioUsd');
        const cuotaInput = document.getElementById('calcCuotaInicial');
        const porcentajeInput = document.getElementById('calcCuotaInicialPorcentaje');
        if (!precioInput || !cuotaInput || !porcentajeInput) return;

        const precioVehiculo = parseMoneyValue(precioInput.value);
        const cuotaInicial = parseMoneyValue(cuotaInput.value);
        const porcentaje = precioVehiculo > 0 ? Math.min((cuotaInicial / precioVehiculo) * 100, 100) : 0;
        porcentajeInput.value = `${porcentaje.toFixed(2)}%`;
    }

    function validarCuotaInicialContraPrecio(mostrarToast = true) {
        const precioInput = document.getElementById('calcPrecioUsd');
        const cuotaInput = document.getElementById('calcCuotaInicial');
        if (!precioInput || !cuotaInput) return true;

        const precioVehiculo = parseMoneyValue(precioInput.value);
        const cuotaInicial = parseMoneyValue(cuotaInput.value);

        if (precioVehiculo > 0 && cuotaInicial > precioVehiculo) {
            cuotaInput.value = precioVehiculo.toFixed(2);
            actualizarPorcentajeCuotaInicial();
            if (mostrarToast) {
                showToast('La cuota inicial no puede superar el 100% del precio del vehículo.', 'warning');
            }
            return false;
        }

        actualizarPorcentajeCuotaInicial();
        return true;
    }

    const calcPrecioVehiculoInput = document.getElementById('calcPrecioUsd');
    const calcCuotaInicialInput = document.getElementById('calcCuotaInicial');
    [calcPrecioVehiculoInput, calcCuotaInicialInput].forEach(input => {
        if (!input) return;
        input.addEventListener('input', (e) => {
            e.target.value = normalizarDecimalInput(e.target.value);
            validarCuotaInicialContraPrecio(true);
        });
        input.addEventListener('blur', (e) => {
            e.target.value = formatearDecimal(e.target.value);
            validarCuotaInicialContraPrecio(true);
        });
    });
    actualizarPorcentajeCuotaInicial();

    function aplicarCostoGpsSegunSeleccion() {
        const calcGps = document.getElementById('calcGps');
        const calcCostoGps = document.getElementById('calcCostoGps');
        const calcTipoGpsGroup = document.getElementById('calcTipoGpsGroup');
        if (!calcGps || !calcCostoGps) return;

        const gpsSeleccionado = String(calcGps.value || '').trim().toUpperCase();
        const mostrarTipoGps = gpsSeleccionado === 'SI';

        if (calcTipoGpsGroup) {
            calcTipoGpsGroup.style.display = mostrarTipoGps ? '' : 'none';
        }

        calcCostoGps.readOnly = !mostrarTipoGps;

        if (!mostrarTipoGps) {
            calcCostoGps.value = '00.00';
        }
    }

    const calcGpsControl = document.getElementById('calcGps');
    const calcCostoGpsInput = document.getElementById('calcCostoGps');
    if (calcGpsControl) {
        calcGpsControl.addEventListener('change', aplicarCostoGpsSegunSeleccion);
    }
    if (calcCostoGpsInput) {
        calcCostoGpsInput.addEventListener('input', () => {
            aplicarCostoGpsSegunSeleccion();
        });
    }
    aplicarCostoGpsSegunSeleccion();

    function actualizarMesesCuotasDobles() {
        const calcCuotasDobles = document.getElementById('calcCuotasDobles');
        const calcMesesCuotasDoblesGroup = document.getElementById('calcMesesCuotasDoblesGroup');
        const calcMesesCuotasDobles = document.getElementById('calcMesesCuotasDobles');
        if (!calcCuotasDobles || !calcMesesCuotasDoblesGroup || !calcMesesCuotasDobles) return;

        const mostrarMeses = String(calcCuotasDobles.value || '').trim().toUpperCase() === 'SI';
        calcMesesCuotasDoblesGroup.style.display = mostrarMeses ? '' : 'none';
        calcMesesCuotasDobles.value = 'Agosto / Enero';
        calcMesesCuotasDobles.readOnly = true;
    }

    function actualizarVisibilidadMesesCuotasDoblesSolicitud() {
        const regCuotasDobles = document.getElementById('regCuotasDobles');
        const regMesesCuotasDoblesGroup = document.getElementById('regMesesCuotasDoblesGroup');
        const regMesesCuotasDobles = document.getElementById('regMesesCuotasDobles');
        if (!regCuotasDobles || !regMesesCuotasDoblesGroup || !regMesesCuotasDobles) return;

        const mostrarMeses = String(regCuotasDobles.value || '').trim().toUpperCase() === 'SI';
        regMesesCuotasDoblesGroup.style.display = mostrarMeses ? '' : 'none';
        if (mostrarMeses && !String(regMesesCuotasDobles.value || '').trim()) {
            regMesesCuotasDobles.value = 'Agosto / Enero';
        }
    }

    const calcCuotasDoblesControl = document.getElementById('calcCuotasDobles');
    if (calcCuotasDoblesControl) {
        calcCuotasDoblesControl.addEventListener('change', actualizarMesesCuotasDobles);
    }
    actualizarMesesCuotasDobles();

    const regCuotasDoblesControl = document.getElementById('regCuotasDobles');
    if (regCuotasDoblesControl) {
        regCuotasDoblesControl.addEventListener('change', actualizarVisibilidadMesesCuotasDoblesSolicitud);
    }
    actualizarVisibilidadMesesCuotasDoblesSolicitud();

    const calcPorcentajeSeguroVehicularInput = document.getElementById('calcPorcentajeSeguroVehicular');
    if (calcPorcentajeSeguroVehicularInput) {
        calcPorcentajeSeguroVehicularInput.addEventListener('input', (e) => {
            e.target.value = normalizarDecimalInput(e.target.value);
        });

        calcPorcentajeSeguroVehicularInput.addEventListener('blur', (e) => {
            e.target.value = formatearPorcentaje(e.target.value);
        });
    }

    function actualizarEstadoCostoSeguroVehicular() {
        const tipoSeguroVehicular = document.getElementById('calcTipoSeguroVehicular');
        const costoSeguroVehicular = document.getElementById('calcPorcentajeSeguroVehicular');
        if (!tipoSeguroVehicular || !costoSeguroVehicular) return;

        const esEndosado = String(tipoSeguroVehicular.value || '').trim().toUpperCase() === 'ENDOSADO';
        costoSeguroVehicular.readOnly = esEndosado;
        costoSeguroVehicular.classList.toggle('disabled', esEndosado);
        costoSeguroVehicular.classList.toggle('is-readonly', esEndosado);
    }

    const calcDesgravamenControl = document.getElementById('calcDesgravamen');
    if (calcDesgravamenControl) {
        calcDesgravamenControl.addEventListener('change', () => {
            updateTipoSeguroDesgravamenCalculoVisibility();
            aplicarSegurosSolicitudDesdeCalculo();
        });
    }

    ['calcTipoSeguroVehicular', 'calcTipoSeguroDesgravamen'].forEach(id => {
        const control = document.getElementById(id);
        if (!control) return;
        control.addEventListener('change', () => {
            if (id === 'calcTipoSeguroVehicular') actualizarEstadoCostoSeguroVehicular();
            aplicarSegurosSolicitudDesdeCalculo();
        });
    });

    actualizarEstadoCostoSeguroVehicular();

    const regSegDesgravamenControl = document.getElementById('regSegDesgravamen');
    if (regSegDesgravamenControl) {
        regSegDesgravamenControl.addEventListener('change', updateTipoSeguroDesgravamenSolicitudVisibility);
    }

    updateTipoSeguroDesgravamenCalculoVisibility();
    updateTipoSeguroDesgravamenSolicitudVisibility();

    // ========================================
    // REGISTRO DE SOLICITUD - Handlers & Logic
    // ========================================

    const regCelularInput = document.getElementById('regCelular');
    if (regCelularInput) {
        regCelularInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            clearCelularSolicitudHighlight();
        });
    }

    const regVehTarjetaNombreSelect = document.getElementById('regVehTarjetaNombre');
    const terceroPropiedadFields = [
        'regVehTerceroTipoDoc',
        'regVehTerceroNumero',
        'regVehTerceroNombres',
        'regVehTerceroApePaterno',
        'regVehTerceroApeMaterno'
    ];

    function actualizarDatosTerceroPropiedad(clearWhenHidden = false) {
        const tarjetaSelect = document.getElementById('regVehTarjetaNombre');
        const terceroData = document.getElementById('regVehTerceroData');
        if (!tarjetaSelect || !terceroData) return;

        const esTercero = tarjetaSelect.value === 'TERCERO';
        terceroData.style.display = esTercero ? 'flex' : 'none';

        terceroPropiedadFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field) return;
            field.disabled = isSolicitudReadOnly || !esTercero;
            if (!esTercero && clearWhenHidden && fieldId !== 'regVehTerceroTipoDoc') {
                field.value = '';
            }
            if (!esTercero && fieldId === 'regVehTerceroTipoDoc') {
                field.value = 'DNI';
            }
        });
    }

    if (regVehTarjetaNombreSelect) {
        regVehTarjetaNombreSelect.addEventListener('change', () => actualizarDatosTerceroPropiedad(true));
        actualizarDatosTerceroPropiedad(false);
    }

    function isRiesgosPendienteSolicitud(solicitud) {
        return !!(solicitud
            && String(solicitud.etapa || '').trim().toUpperCase() === 'RIESGOS'
            && String(solicitud.estado || '').trim().toUpperCase() === 'PENDIENTE');
    }

    function volverABandejaEntradaDesdeSolicitud() {
        stageNavigationEnabledForCurrentFlow = false;
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloBandeja').classList.add('active');

        navItems.forEach(n => n.classList.remove('active'));
        const navBandeja = document.getElementById('navBandeja');
        if (navBandeja) navBandeja.classList.add('active');

        applyBandejaFilters();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Regresar de Registro: si la solicitud está en RIESGOS/PENDIENTE vuelve a Bandeja; caso contrario vuelve al Resultado.
    document.getElementById('btnRegresarRegistro').addEventListener('click', () => {
        saveCurrentRegistrationState();
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);

        if (normalizarEtapa(solicitudActual?.etapa) === 'DOCUMENTARIA') {
            volverABandejaEntradaDesdeSolicitud();
            return;
        }

        if (isRiesgosPendienteSolicitud(solicitudActual) || isCasoObservadoORechazadoSolicitud(solicitudActual)) {
            volverABandejaEntradaDesdeSolicitud();
            return;
        }

        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloResultado').classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Estado civil changes -> toggle separación de bienes
    const regEstadoCivil = document.getElementById('regEstadoCivil');
    const regSeparacionBienes = document.getElementById('regSeparacionBienes');

    function actualizarVisibilidadSeparacionBienes() {
        const estadoCivilControl = document.getElementById('regEstadoCivil');
        const separacionGroup = document.getElementById('regSeparacionBienesGroup');
        const separacionControl = document.getElementById('regSeparacionBienes');
        if (!estadoCivilControl || !separacionControl) return;

        const mostrarSeparacion = estadoCivilControl.value === 'CASADO';
        if (separacionGroup) {
            separacionGroup.style.display = mostrarSeparacion ? '' : 'none';
        }

        if (mostrarSeparacion) {
            separacionControl.disabled = false;
            separacionControl.classList.remove('disabled');
        } else {
            separacionControl.value = '';
            separacionControl.disabled = true;
            separacionControl.classList.add('disabled');
        }
    }

    regEstadoCivil.addEventListener('change', () => {
        const regConyugeCard = document.getElementById('regConyugeCard');
        const estadoCivilConConyuge = esEstadoCivilConIngresosConyuge(regEstadoCivil.value);

        actualizarVisibilidadSeparacionBienes();

        if (estadoCivilConConyuge) {
            if (regConyugeCard) regConyugeCard.style.display = 'block';
            const regConTipoDoc = document.getElementById('regConTipoDoc');
            if (regConTipoDoc && !regConTipoDoc.value) regConTipoDoc.value = 'DNI';
        } else {
            limpiarConyugeSolicitud();
        }

        actualizarVisibilidadMancomunaIngresos();
        actualizarVisibilidadIngresosSolicitud();
    });

    const regMancomunaIngresos = document.getElementById('regMancomunaIngresos');
    if (regMancomunaIngresos) {
        regMancomunaIngresos.addEventListener('change', () => {
            actualizarVisibilidadIngresosSolicitud();
        });
    }

    const regVehNroDocVendedor = document.getElementById('regVehNroDocVendedor');
    if (regVehNroDocVendedor) {
        regVehNroDocVendedor.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
        });
    }


    // Department / Province / District cascade populating
    const regDepartamento = document.getElementById('regDepartamento');
    const regProvincia = document.getElementById('regProvincia');
    const regDistrito = document.getElementById('regDistrito');
    
    const provinciasPorDepto = {
        LIMA: ['LIMA', 'CAÑETE', 'HUAURA'],
        AREQUIPA: ['AREQUIPA', 'CAMANA', 'CAYLLOMA'],
        'LA LIBERTAD': ['TRUJILLO', 'ASCOPE', 'PACASMAYO']
    };
    
    const distritosPorProvincia = {
        LIMA: ['MIRAFLORES', 'SAN ISIDRO', 'ATE', 'PURUCHUCO', 'SANTIAGO DE SURCO'],
        CAÑETE: ['SAN VICENTE', 'MALA', 'ASIA'],
        HUAURA: ['HUACHO', 'HUALMAY'],
        AREQUIPA: ['AREQUIPA', 'YANAHUARA', 'CAYMA'],
        TRUJILLO: ['TRUJILLO', 'VICTOR LARCO', 'LA ESPERANZA']
    };

    regDepartamento.addEventListener('change', () => {
        const depto = regDepartamento.value;
        regProvincia.innerHTML = '<option value="" disabled selected>Seleccionar</option>';
        regDistrito.innerHTML = '<option value="" disabled selected>Seleccionar</option>';
        if (provinciasPorDepto[depto]) {
            provinciasPorDepto[depto].forEach(prov => {
                const opt = document.createElement('option');
                opt.value = prov;
                opt.textContent = prov;
                regProvincia.appendChild(opt);
            });
        }
    });

    regProvincia.addEventListener('change', () => {
        const prov = regProvincia.value;
        regDistrito.innerHTML = '<option value="" disabled selected>Seleccionar</option>';
        if (distritosPorProvincia[prov]) {
            distritosPorProvincia[prov].forEach(dist => {
                const opt = document.createElement('option');
                opt.value = dist;
                opt.textContent = dist;
                regDistrito.appendChild(opt);
            });
        }
    });

    // Checklist dynamic document management
    let attachedDocs = [];
    let pendingFileObject = null;
    let editingDocId = null;

    const checklistTableBody = document.getElementById('checklistTableBody');
    const inputHiddenFile = document.getElementById('inputHiddenFile');
    const modalDocNameOverlay = document.getElementById('modalDocNameOverlay');
    const inputDocName = document.getElementById('inputDocName');
    const btnSaveDocName = document.getElementById('btnSaveDocName');
    const btnCancelDocName = document.getElementById('btnCancelDocName');
    const docChecklist2Body = document.getElementById('docChecklist2Body');
    const docChecklist2FileInput = document.getElementById('docChecklist2FileInput');
    const docChecklist2Counter = document.getElementById('docChecklist2Counter');
    const docChecklist2Card = document.getElementById('docChecklist2Card');
    const docChecklist2Subtitle = document.getElementById('docChecklist2Subtitle');
    const docChecklist2Content = document.getElementById('docChecklist2Content');
    const docChecklist2Footer = document.getElementById('docChecklist2Footer');
    const docChecklist2Comentario = document.getElementById('docChecklist2Comentario');
    const docChecklist2ComentarioLabel = document.getElementById('docChecklist2ComentarioLabel');
    const docChecklist2ComentarioCounter = document.getElementById('docChecklist2ComentarioCounter');
    const docOperacionesObservation = document.getElementById('docOperacionesObservation');
    const btnResponderObservacionOperaciones = document.getElementById('btnResponderObservacionOperaciones');
    const docOpsAnalista = document.getElementById('docOpsAnalista');
    const docOpsMotivo = document.getElementById('docOpsMotivo');
    const docOpsMotivoLabel = document.getElementById('docOpsMotivoLabel');
    const docOpsFechaHora = document.getElementById('docOpsFechaHora');
    const docOpsComentarioAnalista = document.getElementById('docOpsComentarioAnalista');
    const docOpsComentarioCards = document.getElementById('docOpsComentarioCards');
    const docOpsExecutiveCommentBox = document.getElementById('docOpsExecutiveCommentBox');
    const docOpsComentarioEjecutivo = document.getElementById('docOpsComentarioEjecutivo');
    const documentariaPageTitle = document.getElementById('documentariaPageTitle');
    const btnEnviarOperacionesChecklist2 = document.getElementById('btnEnviarOperacionesChecklist2');
    const btnResponderObservacionRiesgos = document.getElementById('btnResponderObservacionRiesgos');
    const regRespuestaRiesgosPanel = document.getElementById('regRespuestaRiesgosPanel');
    const regRespuestaRiesgosInputBox = document.getElementById('regRespuestaRiesgosInputBox');
    const regRespuestaRiesgosComentario = document.getElementById('regRespuestaRiesgosComentario');
    const regRespuestaRiesgosCounter = document.getElementById('regRespuestaRiesgosCounter');
    const regDocumentariaComentarioPanel = document.getElementById('regDocumentariaComentarioPanel');
    const regDocumentariaComentario = document.getElementById('regDocumentariaComentario');
    const regDocumentariaComentarioCounter = document.getElementById('regDocumentariaComentarioCounter');
    const btnEnviarOperacionesSolicitud = document.getElementById('btnEnviarOperacionesSolicitud');
    const regRespuestaOperacionesPanel = document.getElementById('regRespuestaOperacionesPanel');
    const regRespuestaOperacionesComentario = document.getElementById('regRespuestaOperacionesComentario');
    const regRespuestaOperacionesCounter = document.getElementById('regRespuestaOperacionesCounter');
    const btnEnviarRespuestaOperaciones = document.getElementById('btnEnviarRespuestaOperaciones');
    const docPostAprobacionCard = document.getElementById('docPostAprobacionCard');
    const docPostAprobacionList = document.getElementById('docPostAprobacionList');
    const btnVerMasPostDocs = document.getElementById('btnVerMasPostDocs');
    const docGarantiaContratoActions = document.getElementById('docGarantiaContratoActions');
    const btnGenerarContratoGarantia = document.getElementById('btnGenerarContratoGarantia');

    const DOC_CHECKLIST2_MAX = 15;
    let docNameContext = null;
    let docChecklist2Docs = [];
    let docChecklist2ComentarioValue = '';
    let pendingChecklist2FileObject = null;
    let editingChecklist2Index = null;
    let postAprobacionCollapsed = false;
    let postAprobacionCompletionPopupShown = false;
    let currentDocumentariaSolicitud = null;
    let isChecklist2ReadOnly = false;
    let contratoGarantiaGenerado = false;
    const downloadedPostAprobacionDocs = new Set();

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function isPdfFile(file) {
        if (!file) return false;
        return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    }

    function isOperacionesObservadoSolicitud(solicitud) {
        return !!(solicitud && solicitud.operacionesObservacion);
    }

    function isSolicitudRechazada(solicitud) {
        const estado = normalizarEtapa(solicitud?.estado);
        const tipoOperacion = normalizarEtapa(solicitud?.operacionesObservacion?.tipo);
        const tipoRiesgos = normalizarEtapa((solicitud?.riesgosDecision || solicitud?.riesgosObservacion)?.tipo);
        return estado === 'RECHAZADO' || tipoOperacion === 'RECHAZADO' || tipoRiesgos === 'RECHAZADO';
    }

    function isRiesgosObservadoSolicitud(solicitud) {
        const etapa = normalizarEtapa(solicitud?.etapa);
        const estado = normalizarEtapa(solicitud?.estado);
        return etapa === 'RIESGOS' && estado === 'OBSERVADO';
    }

    function isRiesgosObservadoEditableSolicitud(solicitud) {
        return isRiesgosObservadoSolicitud(solicitud);
    }

    function isRiesgosConChecklistSolicitud(solicitud) {
        const etapa = normalizarEtapa(solicitud?.etapa);
        const estado = normalizarEtapa(solicitud?.estado);
        return etapa === 'RIESGOS' && ['PENDIENTE', 'OBSERVADO', 'RECHAZADO'].includes(estado);
    }

    function ensureRiesgosChecklist1Inicial(solicitud) {
        if (!isRiesgosConChecklistSolicitud(solicitud)) return;
        if (!Array.isArray(solicitud.documentos) || solicitud.documentos.length === 0) {
            solicitud.documentos = [
                { id: `${solicitud.id || 'SOL'}-CL1-001`, name: `DNI_cliente_${solicitud.id || 'SOL'}.pdf` }
            ];
        }
        if (typeof solicitud.chkManualDni !== 'boolean') solicitud.chkManualDni = true;
    }

    function setRegistroFieldLocked(field, locked) {
        if (!field) return;
        if (locked) {
            if (field.dataset.riesgosObservedLock !== 'true') {
                field.dataset.prevDisabledRiesgos = String(field.disabled);
                field.dataset.prevReadonlyRiesgos = String(field.hasAttribute('readonly'));
                field.dataset.prevDisabledClassRiesgos = String(field.classList.contains('disabled'));
                field.dataset.riesgosObservedLock = 'true';
            }
            field.disabled = true;
            field.classList.add('disabled', 'is-readonly');
            if (field.tagName !== 'SELECT') field.setAttribute('readonly', 'readonly');
            return;
        }

        if (field.dataset.riesgosObservedLock === 'true') {
            field.disabled = field.dataset.prevDisabledRiesgos === 'true';
            if (field.dataset.prevReadonlyRiesgos === 'true') {
                field.setAttribute('readonly', 'readonly');
            } else {
                field.removeAttribute('readonly');
            }
            field.classList.toggle('disabled', field.dataset.prevDisabledClassRiesgos === 'true');
            field.classList.remove('is-readonly');
            delete field.dataset.riesgosObservedLock;
            delete field.dataset.prevDisabledRiesgos;
            delete field.dataset.prevReadonlyRiesgos;
            delete field.dataset.prevDisabledClassRiesgos;
        }
    }

    function lockEstadoVehiculoNuevo() {
        const estadoVehiculo = document.getElementById('regVehEstado');
        if (!estadoVehiculo) return;
        estadoVehiculo.value = 'Nuevo';
        estadoVehiculo.disabled = true;
        estadoVehiculo.classList.add('disabled', 'is-readonly');
        estadoVehiculo.setAttribute('aria-disabled', 'true');
    }

    function lockDatosClienteYConyugeRiesgosObservado(solicitud) {
        const locked = isRiesgosObservadoEditableSolicitud(solicitud);

        const datosClienteIds = [
            'regTipoDoc', 'regNroDoc', 'regNombres', 'regApePaterno', 'regApeMaterno',
            'regFechaNac', 'regCelular', 'regCorreo', 'regSexo', 'regNacionalidad',
            'regResidencia', 'regDireccion', 'regDepartamento', 'regProvincia', 'regDistrito',
            'regEstadoCivil', 'regMancomunaIngresos', 'regSeparacionBienes', 'stickyRegTipoDoc', 'stickyRegNroDoc',
            'stickyRegNombres', 'stickyRegApePaterno'
        ];

        const datosConyugeIds = [
            'regConTipoDoc', 'regConNroDoc', 'regConApePaterno', 'regConApeMaterno',
            'regConFechaNac', 'regConNacionalidad'
        ];

        [...datosClienteIds, ...datosConyugeIds].forEach(id => setRegistroFieldLocked(document.getElementById(id), locked));
    }

    function isOperacionesRespuestaPermitida(solicitud) {
        if (!isOperacionesObservadoSolicitud(solicitud) || isSolicitudRechazada(solicitud)) return false;
        const tipoDecision = normalizarEtapa(solicitud?.operacionesObservacion?.tipo || solicitud?.estado);
        return tipoDecision === 'OBSERVADO';
    }

    function isRiesgosObservadoORechazadoSolicitud(solicitud) {
        const etapa = normalizarEtapa(solicitud?.etapa);
        const estado = normalizarEtapa(solicitud?.estado);
        return etapa === 'RIESGOS' && ['OBSERVADO', 'RECHAZADO'].includes(estado);
    }

    function isCasoObservadoORechazadoSolicitud(solicitud) {
        return isRiesgosObservadoORechazadoSolicitud(solicitud) || isOperacionesObservadoSolicitud(solicitud);
    }

    function getEjecutivoNombreDesdeContexto() {
        const usuarioRegistro = String(document.getElementById('regUsuario')?.textContent || '').trim();
        const usuarioHeader = String(document.querySelector('.header-user-name')?.textContent || '').replace(/^Hola\s+/i, '').replace(/[!¡]/g, '').trim();
        const usuario = usuarioRegistro || usuarioHeader || 'ALOCHA';
        return `${usuario} - Ejecutivo`;
    }

    function isOperacionesRespuestaHabilitada() {
        return !!(currentDocumentariaSolicitud && currentDocumentariaSolicitud.operacionesRespuestaHabilitada);
    }

    function isOperacionesRespuestaEnviada() {
        return !!(currentDocumentariaSolicitud && currentDocumentariaSolicitud.operacionesRespuestaEnviada);
    }

    function formatFechaHoraActual() {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
    }

    function getEjecutivoRegistroNombre() {
        return getEjecutivoNombreDesdeContexto();
    }

    function getComentarioEditableSolicitud(solicitud) {
        if (!solicitud) return '';
        if (typeof solicitud.comentariosBorrador === 'string') return solicitud.comentariosBorrador;
        if (solicitud.comentarioEjecutivo && typeof solicitud.comentarioEjecutivo.comentario === 'string') {
            return solicitud.comentarioEjecutivo.comentario;
        }
        return solicitud.comentarios || '';
    }

    function registrarComentarioEjecutivoSolicitud(solicitud, comentario, fechaHora) {
        if (!solicitud) return;
        const comentarioLimpio = String(comentario || '').trim();
        solicitud.comentariosBorrador = comentarioLimpio;
        solicitud.comentarios = comentarioLimpio;
        if (!comentarioLimpio) return;
        solicitud.comentarioEjecutivo = {
            ejecutivo: getEjecutivoRegistroNombre(),
            fechaHora: fechaHora || formatFechaHoraActual(),
            comentario: comentarioLimpio
        };
    }

    function registrarRespuestaEjecutivoSolicitud(solicitud, origen, comentario, fechaHora) {
        if (!solicitud) return false;
        const comentarioLimpio = String(comentario || '').trim();
        if (!comentarioLimpio) return false;
        if (!Array.isArray(solicitud.respuestasEjecutivo)) solicitud.respuestasEjecutivo = [];
        solicitud.respuestasEjecutivo.push({
            origen: origen === 'operaciones' ? 'operaciones' : 'riesgos',
            ejecutivo: getEjecutivoNombreDesdeContexto(),
            fechaHora: fechaHora || formatFechaHoraActual(),
            comentario: comentarioLimpio
        });
        return true;
    }

    function getMotivoDecisionLabel(tipo, origen) {
        const tipoNormalizado = normalizarEtapa(tipo);
        const origenNormalizado = origen === 'operaciones' ? 'operaciones' : 'riesgos';
        if (tipoNormalizado === 'APROBADO') return 'Detalle de aprobación';
        if (tipoNormalizado === 'RECHAZADO') {
            return origenNormalizado === 'operaciones' ? 'Motivo de rechazo' : 'Motivo de Rechazo';
        }
        return 'Motivo de observación';
    }

    function formatearComentarioEjecutivo(solicitud) {
        const comentario = solicitud && solicitud.comentarioEjecutivo;
        if (comentario && comentario.comentario) {
            return [
                'Comentarios del Ejecutivo',
                `Ejecutivo: ${comentario.ejecutivo || 'ALOCHA - Ejecutivo'}`,
                `Fecha y hora: ${comentario.fechaHora || '-'}`,
                `Comentario: ${comentario.comentario || '-'}`
            ].join('\n');
        }
        const comentarioPlano = getComentarioEditableSolicitud(solicitud).trim();
        if (!comentarioPlano) return '';
        return [
            'Comentarios del Ejecutivo',
            'Ejecutivo: ALOCHA - Ejecutivo',
            `Fecha y hora: ${solicitud?.fecha || '-'}`,
            `Comentario: ${comentarioPlano}`
        ].join('\n');
    }

    function formatearDecisionAnalista(decision, origen, estadoSolicitud) {
        if (!decision) return '';
        const tipoDecision = decision.tipo || estadoSolicitud || '';
        const esOperaciones = origen === 'operaciones';
        const tipoNormalizado = normalizarEtapa(tipoDecision);
        const titulo = tipoNormalizado === 'APROBADO'
            ? (esOperaciones ? 'Aprobación de Operaciones' : 'Aprobación de Riesgos')
            : (tipoNormalizado === 'RECHAZADO'
                ? (esOperaciones ? 'Comentario de rechazo de Operaciones' : 'Comentario de rechazo de Riesgos')
                : (esOperaciones ? 'Comentario de observación de Operaciones' : 'Comentario de observación de Riesgos'));
        const analistaLabel = esOperaciones ? 'Analista de operaciones' : 'Analista de riesgos';
        const comentarioLabel = tipoNormalizado === 'APROBADO'
            ? (esOperaciones ? 'Comentario de aprobación de Operaciones' : 'Comentario de aprobación de Riesgos')
            : (esOperaciones ? 'Comentario del analista de operaciones' : 'Comentario del analista de riesgos');
        return [
            titulo,
            `${analistaLabel}: ${decision.analista || '-'}`,
            `${getMotivoDecisionLabel(tipoDecision, origen)}: ${decision.motivo || '-'}`,
            `Fecha y hora: ${decision.fechaHora || '-'}`,
            `${comentarioLabel}: ${decision.comentario || '-'}`
        ].join('\n');
    }

    function formatearComentariosSolicitud(solicitud, options = {}) {
        if (!solicitud) return '';
        const includeRiesgos = options.includeRiesgos !== false;
        const includeOperaciones = options.includeOperaciones === true;
        const bloques = [];
        const comentarioEjecutivo = formatearComentarioEjecutivo(solicitud);
        if (comentarioEjecutivo) bloques.push(comentarioEjecutivo);

        const estado = normalizarEtapa(solicitud.estado);
        const etapa = normalizarEtapa(solicitud.etapa);
        const riesgosDecision = solicitud.riesgosDecision || solicitud.riesgosObservacion;
        if (debeMostrarHistorialRiesgos(solicitud, includeRiesgos, riesgosDecision)) {
            if (riesgosDecision) bloques.push(formatearDecisionAnalista(riesgosDecision, 'riesgos', solicitud.estado));
            const respuestasRiesgos = getRespuestasEjecutivoCards(solicitud, 'riesgos').map(card => [
                card.titulo,
                `Ejecutivo: ${card.detalles?.find(item => item.label === 'Ejecutivo')?.value || '-'}`,
                `Fecha y hora: ${card.detalles?.find(item => item.label === 'Fecha y hora')?.value || '-'}`,
                `${card.comentarioLabel || 'Comentario'}: ${card.comentario || '-'}`
            ].join('\n'));
            bloques.push(...respuestasRiesgos);
        }

        if (includeOperaciones && isOperacionesObservadoSolicitud(solicitud)) {
            bloques.push(formatearDecisionAnalista(solicitud.operacionesObservacion, 'operaciones', solicitud.estado));
        }

        return bloques.join('\n\n');
    }

    function formatearComentarioEjecutivoParaCaja(solicitud) {
        const comentario = solicitud && solicitud.comentarioEjecutivo;
        if (comentario && comentario.comentario) {
            return `Ejecutivo: ${comentario.ejecutivo || 'ALOCHA - Ejecutivo'}\nFecha y hora: ${comentario.fechaHora || '-'}\nComentario: ${comentario.comentario || '-'}`;
        }
        const comentarioPlano = getComentarioEditableSolicitud(solicitud).trim();
        if (!comentarioPlano) return '';
        return `Ejecutivo: ALOCHA - Ejecutivo\nFecha y hora: ${solicitud?.fecha || '-'}\nComentario: ${comentarioPlano}`;
    }


    function getComentarioEjecutivoCardData(solicitud) {
        const comentario = solicitud && solicitud.comentarioEjecutivo;
        if (comentario && comentario.comentario) {
            return {
                tipo: 'ejecutivo',
                titulo: 'Comentario del Ejecutivo',
                rol: 'Ejecutivo',
                detalles: [
                    { label: 'Ejecutivo', value: comentario.ejecutivo || 'ALOCHA - Ejecutivo' },
                    { label: 'Fecha y hora', value: comentario.fechaHora || '-' }
                ],
                comentarioLabel: 'Comentario',
                comentario: comentario.comentario || '-'
            };
        }

        const comentarioPlano = getComentarioEditableSolicitud(solicitud).trim();
        if (!comentarioPlano) return null;
        return {
            tipo: 'ejecutivo',
            titulo: 'Comentario del Ejecutivo',
            rol: 'Ejecutivo',
            detalles: [
                { label: 'Ejecutivo', value: 'ALOCHA - Ejecutivo' },
                { label: 'Fecha y hora', value: solicitud?.fecha || '-' }
            ],
            comentarioLabel: 'Comentario',
            comentario: comentarioPlano
        };
    }

    function getDecisionAnalistaCardData(decision, origen, estadoSolicitud) {
        if (!decision) return null;
        const tipoDecision = decision.tipo || estadoSolicitud || '';
        const esOperaciones = origen === 'operaciones';
        const tipoNormalizado = normalizarEtapa(tipoDecision);
        const esAprobado = tipoNormalizado === 'APROBADO';
        const esRechazo = tipoNormalizado === 'RECHAZADO';
        const titulo = esAprobado
            ? (esOperaciones ? 'Aprobación de Operaciones' : 'Aprobación de Riesgos')
            : (esRechazo
                ? (esOperaciones ? 'Comentario de rechazo de Operaciones' : 'Comentario de rechazo de Riesgos')
                : (esOperaciones ? 'Comentario de observación de Operaciones' : 'Comentario de observación de Riesgos'));
        const analistaLabel = esOperaciones ? 'Analista de operaciones' : 'Analista de riesgos';
        const comentarioLabel = esAprobado
            ? (esOperaciones ? 'Comentario de aprobación de Operaciones' : 'Comentario de aprobación de Riesgos')
            : (esOperaciones ? 'Comentario del analista de operaciones' : 'Comentario del analista de riesgos');

        return {
            tipo: esOperaciones ? 'operaciones' : 'riesgos',
            titulo,
            rol: esOperaciones ? 'Operaciones' : 'Riesgos',
            detalles: [
                { label: analistaLabel, value: decision.analista || '-' },
                { label: getMotivoDecisionLabel(tipoDecision, origen), value: decision.motivo || '-' },
                { label: 'Fecha y hora', value: decision.fechaHora || '-' }
            ],
            comentarioLabel,
            comentario: decision.comentario || '-'
        };
    }

    function tieneRespuestasEjecutivo(solicitud, origen) {
        const origenNormalizado = origen === 'operaciones' ? 'operaciones' : 'riesgos';
        return (Array.isArray(solicitud?.respuestasEjecutivo) ? solicitud.respuestasEjecutivo : [])
            .some(resp => (resp.origen || 'riesgos') === origenNormalizado && String(resp.comentario || '').trim());
    }

    function debeMostrarHistorialRiesgos(solicitud, includeRiesgos, riesgosDecision) {
        if (!includeRiesgos || !solicitud) return false;
        const etapa = normalizarEtapa(solicitud.etapa);
        const estado = normalizarEtapa(solicitud.estado);
        const etapaConHistorialRiesgos = ['RIESGOS', 'DOCUMENTARIA', 'OPERACIONES', 'FIRMA', 'FIRMAS', 'ACTIVACION', 'ACTIVADO'].includes(etapa);
        return etapaConHistorialRiesgos
            && (
                ['OBSERVADO', 'RECHAZADO'].includes(estado)
                || !!riesgosDecision
                || tieneRespuestasEjecutivo(solicitud, 'riesgos')
            );
    }

    function getRespuestasEjecutivoCards(solicitud, origen) {
        const origenNormalizado = origen === 'operaciones' ? 'operaciones' : 'riesgos';
        return (Array.isArray(solicitud?.respuestasEjecutivo) ? solicitud.respuestasEjecutivo : [])
            .filter(resp => (resp.origen || 'riesgos') === origenNormalizado && String(resp.comentario || '').trim())
            .map(resp => ({
                tipo: 'ejecutivo',
                titulo: 'Comentario del Ejecutivo',
                rol: 'Ejecutivo',
                detalles: [
                    { label: 'Ejecutivo', value: resp.ejecutivo || getEjecutivoNombreDesdeContexto() },
                    { label: 'Fecha y hora', value: resp.fechaHora || '-' }
                ],
                comentarioLabel: 'Comentario',
                comentario: resp.comentario || '-'
            }));
    }

    function getComentariosSolicitudCards(solicitud, options = {}) {
        if (!solicitud) return [];
        const includeRiesgos = options.includeRiesgos !== false;
        const includeOperaciones = options.includeOperaciones === true;
        const cards = [];
        const comentarioEjecutivo = getComentarioEjecutivoCardData(solicitud);
        if (comentarioEjecutivo) cards.push(comentarioEjecutivo);

        const estado = normalizarEtapa(solicitud.estado);
        const etapa = normalizarEtapa(solicitud.etapa);
        const riesgosDecision = solicitud.riesgosDecision || solicitud.riesgosObservacion;
        if (debeMostrarHistorialRiesgos(solicitud, includeRiesgos, riesgosDecision)) {
            const riesgosCard = getDecisionAnalistaCardData(riesgosDecision, 'riesgos', solicitud.estado);
            if (riesgosCard) cards.push(riesgosCard);
            cards.push(...getRespuestasEjecutivoCards(solicitud, 'riesgos'));
        }

        if (includeOperaciones) {
            if (isOperacionesObservadoSolicitud(solicitud)) {
                const operacionesCard = getDecisionAnalistaCardData(solicitud.operacionesObservacion, 'operaciones', solicitud.estado);
                if (operacionesCard) cards.push(operacionesCard);
            }
            cards.push(...getRespuestasEjecutivoCards(solicitud, 'operaciones'));
        }

        return cards;
    }

    function renderComentarioCards(container, cards, emptyMessage = 'No se registraron comentarios.') {
        if (!container) return;
        const cardList = Array.isArray(cards) ? cards.filter(Boolean) : [];
        if (!cardList.length) {
            container.innerHTML = `
                <div class="comment-card-empty">
                    <span>Comentarios</span>
                    <p>${escapeHtml(emptyMessage)}</p>
                </div>
            `;
            container.hidden = false;
            return;
        }

        container.innerHTML = cardList.map(card => {
            const detalles = (card.detalles || []).map(item => `
                <div class="comment-card-row">
                    <span>${escapeHtml(item.label || '')}</span>
                    <strong>${escapeHtml(item.value || '-')}</strong>
                </div>
            `).join('');

            return `
                <div class="comment-card-item comment-card-${escapeHtml(card.tipo || 'ejecutivo')}">
                    <div class="comment-card-header">
                        <strong class="comment-card-title">${escapeHtml(card.titulo || 'Comentario')}</strong>
                        <span class="comment-card-role">${escapeHtml(card.rol || '-')}</span>
                    </div>
                    <div class="comment-card-details">${detalles}</div>
                    <div class="comment-card-main">
                        <span>${escapeHtml(card.comentarioLabel || 'Comentario')}</span>
                        <p>${escapeHtml(card.comentario || '-')}</p>
                    </div>
                </div>
            `;
        }).join('');
        container.hidden = false;
    }

    function actualizarContadorComentarioDocumentaria() {
        if (!regDocumentariaComentario || !regDocumentariaComentarioCounter) return;
        const valor = regDocumentariaComentario.value.slice(0, 250);
        if (valor !== regDocumentariaComentario.value) regDocumentariaComentario.value = valor;
        regDocumentariaComentarioCounter.textContent = `${valor.length}/250`;
    }

    function actualizarContadorRespuestaOperaciones() {
        if (!regRespuestaOperacionesComentario || !regRespuestaOperacionesCounter) return;
        const valor = regRespuestaOperacionesComentario.value.slice(0, 250);
        if (valor !== regRespuestaOperacionesComentario.value) regRespuestaOperacionesComentario.value = valor;
        regRespuestaOperacionesCounter.textContent = `${valor.length}/250`;
    }

    function actualizarRespuestaOperacionesSolicitud(solicitud) {
        const etapa = normalizarEtapa(solicitud?.etapa);
        const estado = normalizarEtapa(solicitud?.estado);
        const puedeResponder = etapa === 'OPERACIONES' && estado === 'OBSERVADO';

        if (regRespuestaOperacionesPanel) regRespuestaOperacionesPanel.hidden = !puedeResponder;
        if (regRespuestaOperacionesComentario) {
            regRespuestaOperacionesComentario.value = puedeResponder ? (solicitud?.respuestaOperacionesBorrador || '') : '';
            regRespuestaOperacionesComentario.disabled = !puedeResponder;
        }
        if (btnEnviarRespuestaOperaciones) {
            btnEnviarRespuestaOperaciones.hidden = true;
            btnEnviarRespuestaOperaciones.style.display = 'none';
        }
        actualizarContadorRespuestaOperaciones();
    }

    if (regRespuestaOperacionesComentario) {
        regRespuestaOperacionesComentario.addEventListener('input', () => {
            const solicitud = solicitudes.find(item => item.id === currentSolicitudId);
            if (solicitud && normalizarEtapa(solicitud.etapa) === 'OPERACIONES' && normalizarEtapa(solicitud.estado) === 'OBSERVADO') {
                solicitud.respuestaOperacionesBorrador = regRespuestaOperacionesComentario.value;
            }
            actualizarContadorRespuestaOperaciones();
        });
    }


    function actualizarControlesDocumentariaSolicitud(solicitud) {
        const etapa = normalizarEtapa(solicitud?.etapa);
        const esDocumentariaPendiente = etapa === 'DOCUMENTARIA' && normalizarEtapa(solicitud?.estado) === 'PENDIENTE';
        const esOperacionesDesdeSolicitud = etapa === 'OPERACIONES' && solicitud?.operacionesDesdeDocumentariaSolicitud === true;

        if (regDocumentariaComentarioPanel) {
            regDocumentariaComentarioPanel.hidden = !(esDocumentariaPendiente || esOperacionesDesdeSolicitud);
        }
        if (regDocumentariaComentario) {
            regDocumentariaComentario.value = esOperacionesDesdeSolicitud
                ? (solicitud.comentarioEnvioOperaciones?.comentario || '')
                : (solicitud.comentarioOperacionesBorrador || '');
            regDocumentariaComentario.disabled = esOperacionesDesdeSolicitud;
        }
        if (btnEnviarOperacionesSolicitud) {
            const estado = normalizarEtapa(solicitud?.estado);
            const esOperacionesObservado = etapa === 'OPERACIONES' && estado === 'OBSERVADO';
            const esSolicitudPendiente = etapa === 'SOLICITUD' && estado === 'PENDIENTE';
            const mostrarBotonEnvio = !esSolicitudPendiente && (esDocumentariaPendiente || esOperacionesObservado);

            btnEnviarOperacionesSolicitud.hidden = !mostrarBotonEnvio;
            btnEnviarOperacionesSolicitud.style.display = mostrarBotonEnvio ? 'inline-flex' : 'none';
            btnEnviarOperacionesSolicitud.setAttribute('aria-hidden', String(!mostrarBotonEnvio));
        }
        actualizarContadorComentarioDocumentaria();
    }

    function obtenerFechaHoraActualSolicitud() {
        const ahora = new Date();
        const pad = valor => String(valor).padStart(2, '0');
        return `${pad(ahora.getDate())}-${pad(ahora.getMonth() + 1)}-${ahora.getFullYear()} ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}`;
    }

    function confirmarEnvioSolicitudAOperaciones() {
        const solicitud = solicitudes.find(item => item.id === currentSolicitudId);
        if (!solicitud) return;

        const etapa = normalizarEtapa(solicitud.etapa);
        const estado = normalizarEtapa(solicitud.estado);
        const esDocumentariaPendiente = etapa === 'DOCUMENTARIA' && estado === 'PENDIENTE';
        const esOperacionesObservado = etapa === 'OPERACIONES' && estado === 'OBSERVADO';
        if (!esDocumentariaPendiente && !esOperacionesObservado) return;

        const comentario = esOperacionesObservado
            ? String(regRespuestaOperacionesComentario?.value || '').trim()
            : String(regDocumentariaComentario?.value || '').trim();
        if (!comentario) {
            showToast(esOperacionesObservado
                ? 'Ingrese un comentario para responder la observación de Operaciones.'
                : 'Ingrese un comentario antes de enviar a Operaciones.', 'warning');
            (esOperacionesObservado ? regRespuestaOperacionesComentario : regDocumentariaComentario)?.focus();
            return;
        }

        modalTitle.textContent = 'Confirmar envío a Operaciones';
        modalBody.innerHTML = `
            <div class="popup-confirmacion-simulacion">
                <div class="popup-confirmacion-icon">
                    <span class="material-icons-outlined">help_outline</span>
                </div>
                <p class="popup-confirmacion-text">
                    ¿Está seguro de enviar la solicitud <strong>${escapeHtml(solicitud.id)}</strong> a Operaciones?
                </p>
            </div>
        `;

        const cancelBtn = document.getElementById('modalBtnCancel');
        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);

        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = 'Cancelar';
        newActionBtn.style.display = 'inline-flex';
        newActionBtn.textContent = 'Confirmar';

        newActionBtn.addEventListener('click', () => {
            if (esOperacionesObservado) {
                registrarRespuestaEjecutivoSolicitud(solicitud, 'operaciones', comentario, obtenerFechaHoraActualSolicitud());
                solicitud.respuestaOperacionesBorrador = '';
                solicitud.estado = 'PENDIENTE';
                if (regRespuestaOperacionesComentario) {
                    regRespuestaOperacionesComentario.value = comentario;
                    regRespuestaOperacionesComentario.disabled = true;
                }
                actualizarRespuestaOperacionesSolicitud(solicitud);
                actualizarControlesDocumentariaSolicitud(solicitud);
                applyRegistrationFormReadOnlyState(true);
                closeModal();
                if (typeof applyBandejaFilters === 'function') applyBandejaFilters();
                volverABandejaEntradaDesdeSolicitud();
                showToast('La solicitud fue enviada nuevamente a Operaciones.', 'success');
                return;
            }

            const fechaHoraComentario = obtenerFechaHoraActualSolicitud();
            solicitud.comentarioEnvioOperaciones = {
                ejecutivo: getEjecutivoNombreDesdeContexto(),
                cargo: 'Ejecutivo',
                fechaHora: fechaHoraComentario,
                comentario
            };
            registrarRespuestaEjecutivoSolicitud(solicitud, 'operaciones', comentario, fechaHoraComentario);
            solicitud.comentarioOperacionesBorrador = comentario;
            solicitud.etapa = 'OPERACIONES';
            solicitud.estado = 'PENDIENTE';
            solicitud.operacionesDesdeDocumentariaSolicitud = true;

            closeModal();
            actualizarEstadoRegistroResumen(solicitud);
            renderStageNavigation('registroStageTabs', solicitud.etapa, solicitud.estado, 'SOLICITUD');
            actualizarControlesDocumentariaSolicitud(solicitud);
            applyRegistrationFormReadOnlyState(true);
            if (typeof applyBandejaFilters === 'function') applyBandejaFilters();
            showToast('La solicitud fue enviada a Operaciones.', 'success');
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    if (regDocumentariaComentario) {
        regDocumentariaComentario.addEventListener('input', () => {
            const solicitud = solicitudes.find(item => item.id === currentSolicitudId);
            if (solicitud && normalizarEtapa(solicitud.etapa) === 'DOCUMENTARIA') {
                solicitud.comentarioOperacionesBorrador = regDocumentariaComentario.value;
            }
            actualizarContadorComentarioDocumentaria();
        });
    }

    if (btnEnviarOperacionesSolicitud) {
        btnEnviarOperacionesSolicitud.addEventListener('click', confirmarEnvioSolicitudAOperaciones);
    }

    function toggleRegistroComentariosCards(isReadOnly, solicitud) {
        const regComentarios = document.getElementById('regComentarios');
        const regComentariosCards = document.getElementById('regComentariosCards');
        const regComentariosLabel = document.getElementById('regComentariosLabel');

        if (regComentariosLabel) {
            regComentariosLabel.textContent = isReadOnly ? 'Comentarios' : 'Comentarios del Ejecutivo';
        }

        if (regComentarios) {
            regComentarios.hidden = !!isReadOnly;
        }

        if (regComentariosCards) {
            const mostrarComentariosDeRiesgos = isReadOnly || isRiesgosObservadoEditableSolicitud(solicitud);
            if (mostrarComentariosDeRiesgos) {
                renderComentarioCards(
                    regComentariosCards,
                    getComentariosSolicitudCards(solicitud, {
                        includeRiesgos: true,
                        includeOperaciones: normalizarEtapa(solicitud?.etapa) === 'OPERACIONES'
                    })
                );
            } else {
                regComentariosCards.innerHTML = '';
                regComentariosCards.hidden = true;
            }
        }

        updateRiesgosRespuestaState(solicitud, isReadOnly);
    }

    function updateRiesgosRespuestaCounter() {
        if (!regRespuestaRiesgosComentario || !regRespuestaRiesgosCounter) return;
        const texto = regRespuestaRiesgosComentario.value.slice(0, 250);
        if (texto !== regRespuestaRiesgosComentario.value) regRespuestaRiesgosComentario.value = texto;
        regRespuestaRiesgosCounter.textContent = `${texto.length}/250`;
    }

    function updateRiesgosRespuestaState(solicitud, isReadOnly = isSolicitudReadOnly) {
        const esRespuestaPermitida = isRiesgosObservadoSolicitud(solicitud);
        const respuestaHabilitada = !!(solicitud && solicitud.riesgosRespuestaHabilitada) && esRespuestaPermitida;
        const respuestaEnviada = !!(solicitud && solicitud.riesgosRespuestaEnviada) && esRespuestaPermitida;

        if (regRespuestaRiesgosPanel) {
            regRespuestaRiesgosPanel.hidden = !(isReadOnly && esRespuestaPermitida);
        }
        if (btnResponderObservacionRiesgos) {
            btnResponderObservacionRiesgos.hidden = !(isReadOnly && esRespuestaPermitida) || respuestaHabilitada || respuestaEnviada;
            btnResponderObservacionRiesgos.disabled = !esRespuestaPermitida || respuestaEnviada;
        }
        if (regRespuestaRiesgosInputBox) {
            regRespuestaRiesgosInputBox.hidden = !(isReadOnly && esRespuestaPermitida && respuestaHabilitada && !respuestaEnviada);
        }
        if (regRespuestaRiesgosComentario) {
            regRespuestaRiesgosComentario.disabled = !(isReadOnly && esRespuestaPermitida && respuestaHabilitada && !respuestaEnviada);
            if (!respuestaHabilitada) regRespuestaRiesgosComentario.value = '';
            updateRiesgosRespuestaCounter();
        }

        const btnPasarRiesgos = document.getElementById('btnPasarRiesgos');
        if (btnPasarRiesgos && isReadOnly && esRespuestaPermitida) {
            btnPasarRiesgos.style.display = respuestaHabilitada && !respuestaEnviada ? 'inline-flex' : 'none';
            btnPasarRiesgos.textContent = 'Enviar respuesta a Riesgos';
        } else if (btnPasarRiesgos && isReadOnly) {
            btnPasarRiesgos.style.display = 'none';
            btnPasarRiesgos.textContent = 'Pasar a Riesgos';
        } else if (btnPasarRiesgos && !isReadOnly) {
            btnPasarRiesgos.style.display = 'inline-flex';
            btnPasarRiesgos.textContent = isRiesgosObservadoEditableSolicitud(solicitud) ? 'Reenviar a Riesgos' : 'Pasar a Riesgos';
        }
    }

    function mostrarPopupRespuestaRiesgosExitosa() {
        modalTitle.textContent = 'Respuesta registrada';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-solicitud-text">La respuesta del ejecutivo fue registrada correctamente.</p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
            volverABandejaEntradaDesdeSolicitud();
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function enviarRespuestaARiesgos() {
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
        if (!isRiesgosObservadoSolicitud(solicitudActual)) return false;
        if (!solicitudActual.riesgosRespuestaHabilitada || solicitudActual.riesgosRespuestaEnviada) return false;

        const comentario = String(regRespuestaRiesgosComentario?.value || '').trim();
        if (!comentario) {
            showToast('Ingrese un comentario para responder a Riesgos.', 'warning');
            if (regRespuestaRiesgosComentario) {
                regRespuestaRiesgosComentario.focus();
                regRespuestaRiesgosComentario.classList.add('input-attention');
                setTimeout(() => regRespuestaRiesgosComentario.classList.remove('input-attention'), 1200);
            }
            return true;
        }

        const fechaHora = formatFechaHoraActual();
        registrarRespuestaEjecutivoSolicitud(solicitudActual, 'riesgos', comentario, fechaHora);
        solicitudActual.riesgosRespuestaEnviada = true;
        solicitudActual.riesgosRespuestaHabilitada = false;
        if (regRespuestaRiesgosComentario) regRespuestaRiesgosComentario.value = '';
        toggleRegistroComentariosCards(true, solicitudActual);
        updateRiesgosRespuestaState(solicitudActual, true);
        applyBandejaFilters();
        mostrarPopupRespuestaRiesgosExitosa();
        return true;
    }

    function renderChecklistTable() {
        if (!checklistTableBody) return;
        checklistTableBody.innerHTML = '';

        // Render attached files
        attachedDocs.forEach((doc, index) => {
            const row = document.createElement('tr');
            let actionsHtml = '';
            if (isSolicitudReadOnly) {
                actionsHtml = `
                    <button type="button" class="action-link" data-action="ver" data-index="${index}" style="font-size: 0.8rem; font-weight: 600; color: var(--accent-blue); background: none; border: none; padding: 0; cursor: pointer;">Ver</button>
                `;
            } else {
                actionsHtml = `
                    <button type="button" class="action-link" data-action="ver" data-index="${index}" style="font-size: 0.8rem; font-weight: 600; color: var(--accent-blue); background: none; border: none; padding: 0; cursor: pointer;">Ver</button>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">|</span>
                    <button type="button" class="action-link" data-action="editar" data-index="${index}" style="font-size: 0.8rem; font-weight: 600; color: var(--accent-blue); background: none; border: none; padding: 0; cursor: pointer;">Editar</button>
                    <span style="color: var(--text-muted); font-size: 0.75rem;">|</span>
                    <button type="button" class="action-link" data-action="eliminar" data-index="${index}" style="font-size: 0.8rem; font-weight: 600; color: var(--danger-red); background: none; border: none; padding: 0; cursor: pointer;">Eliminar</button>
                `;
            }

            row.innerHTML = `
                <td style="font-weight: 500; color: var(--text-primary); padding: 12px 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="material-icons-outlined" style="font-size: 18px; color: #ef4444;">picture_as_pdf</span>
                        <span>${doc.name}</span>
                    </div>
                </td>
                <td style="padding: 12px 10px;">
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${actionsHtml}
                    </div>
                </td>
            `;
            checklistTableBody.appendChild(row);
        });

        // Only render one empty upload row at the bottom if NOT read-only
        if (!isSolicitudReadOnly) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td class="text-muted" style="color: var(--text-secondary); font-style: italic; padding: 12px 10px;">Sin archivo adjunto</td>
                <td style="padding: 12px 10px;">
                    <button type="button" class="btn-adjuntar" id="btnTriggerUpload" style="padding: 5px 12px; font-size: 0.75rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                        <span class="material-icons-outlined" style="font-size: 14px;">upload_file</span>
                        Adjuntar
                    </button>
                </td>
            `;
            checklistTableBody.appendChild(emptyRow);

            // Bind event to Adjuntar button
            const btnTriggerUpload = document.getElementById('btnTriggerUpload');
            if (btnTriggerUpload) {
                btnTriggerUpload.addEventListener('click', () => {
                    docNameContext = 'checklist1';
                    editingDocId = null;
                    pendingFileObject = null;
                    if (inputHiddenFile) inputHiddenFile.click();
                });
            }
        }

        // Bind events to Ver, Editar, Eliminar buttons
        checklistTableBody.querySelectorAll('.action-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = btn.dataset.action;
                const index = parseInt(btn.dataset.index);

                if (action === 'ver') {
                    showToast(`Visualizando documento: ${attachedDocs[index].name}`, 'info');
                    modalTitle.textContent = `Visualizar - ${attachedDocs[index].name}`;
                    modalBody.innerHTML = `
                        <div style="background-color: #f1f3f5; border: 1px solid var(--border-color); border-radius: 8px; height: 350px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--text-secondary);">
                            <span class="material-icons-outlined" style="font-size: 64px; color: var(--primary-blue);">picture_as_pdf</span>
                            <p style="font-weight: 600;">[ Simulación de Visor PDF ]</p>
                            <p style="font-size: 0.8rem;">Archivo: ${attachedDocs[index].name}</p>
                        </div>
                    `;
                    document.getElementById('modalBtnCancel').textContent = 'Cerrar';
                    document.getElementById('modalBtnAction').style.display = 'none';
                    modalOverlay.classList.add('active');
                } else if (action === 'editar') {
                    docNameContext = 'checklist1';
                    editingDocId = index;
                    pendingFileObject = null;
                    // Pre-fill modal input with current name without extension
                    inputDocName.value = attachedDocs[index].name.replace(/\.[^/.]+$/, "");
                    modalDocNameOverlay.classList.add('active');
                    inputDocName.focus();
                } else if (action === 'eliminar') {
                    attachedDocs.splice(index, 1);
                    renderChecklistTable();
                    showToast('Documento eliminado.', 'info');
                }
            });
        });

    }

    // Hidden input change handler
    if (inputHiddenFile) inputHiddenFile.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (!isPdfFile(file)) {
                showToast('Solo se permite adjuntar documentos PDF.', 'warning');
                if (inputHiddenFile) inputHiddenFile.value = '';
                return;
            }
            docNameContext = 'checklist1';
            pendingFileObject = file;
            editingDocId = null;

            // Extract filename without extension
            const rawName = file.name.replace(/\.[^/.]+$/, "");
            inputDocName.value = rawName;

            // Open document name modal
            modalDocNameOverlay.classList.add('active');
            inputDocName.focus();
        }
    });

    function getPostAprobacionDownloadButtons() {
        return Array.from(document.querySelectorAll('.documentaria-documents .doc-download-btn'));
    }

    function getPostAprobacionDocNames() {
        return getPostAprobacionDownloadButtons()
            .map(btn => btn.dataset.docName)
            .filter(Boolean);
    }

    function persistCurrentDocumentariaState() {
        if (!currentDocumentariaSolicitud) return;
        if (docChecklist2Comentario) {
            docChecklist2ComentarioValue = docChecklist2Comentario.value.slice(0, 250);
        }
        currentDocumentariaSolicitud.checklist2Docs = docChecklist2Docs;
        currentDocumentariaSolicitud.checklist2Comentario = docChecklist2ComentarioValue;
        currentDocumentariaSolicitud.downloadedPostAprobacionDocs = Array.from(downloadedPostAprobacionDocs);
        currentDocumentariaSolicitud.contratoGarantiaGenerado = contratoGarantiaGenerado;
        currentDocumentariaSolicitud.postAprobacionCollapsed = postAprobacionCollapsed;
        currentDocumentariaSolicitud.postAprobacionCompletionPopupShown = postAprobacionCompletionPopupShown;
        if (isOperacionesObservadoSolicitud(currentDocumentariaSolicitud)) {
            currentDocumentariaSolicitud.operacionesRespuestaHabilitada = !!currentDocumentariaSolicitud.operacionesRespuestaHabilitada;
            currentDocumentariaSolicitud.operacionesRespuestaEnviada = !!currentDocumentariaSolicitud.operacionesRespuestaEnviada;
        }
        actualizarEstadoFirmaChecklist2(currentDocumentariaSolicitud);
        saveSolicitudFirmaAutomaticaState(currentDocumentariaSolicitud);
    }

    function updateOperacionesObservationState() {
        const isOperaciones = isOperacionesObservadoSolicitud(currentDocumentariaSolicitud);
        if (docOperacionesObservation) docOperacionesObservation.hidden = !isOperaciones;
        if (!isOperaciones) return;

        const observacion = currentDocumentariaSolicitud.operacionesObservacion || {};
        const tipoDecision = observacion.tipo || currentDocumentariaSolicitud.estado || 'OBSERVADO';
        const comentarioEjecutivo = formatearComentarioEjecutivoParaCaja(currentDocumentariaSolicitud);

        if (docOpsComentarioCards) {
            renderComentarioCards(
                docOpsComentarioCards,
                getComentariosSolicitudCards(currentDocumentariaSolicitud, { includeRiesgos: false, includeOperaciones: true })
            );
            if (docOpsExecutiveCommentBox) docOpsExecutiveCommentBox.hidden = true;
            const legacyGrid = docOperacionesObservation?.querySelector('.documentaria-operations-observation-grid');
            const legacyAnalystBox = docOpsComentarioAnalista?.closest('.documentaria-operations-comment-box');
            if (legacyGrid) legacyGrid.hidden = true;
            if (legacyAnalystBox) legacyAnalystBox.hidden = true;
        } else {
            if (docOpsExecutiveCommentBox) docOpsExecutiveCommentBox.hidden = !comentarioEjecutivo;
            if (docOpsComentarioEjecutivo) docOpsComentarioEjecutivo.textContent = comentarioEjecutivo || '-';
            if (docOpsAnalista) docOpsAnalista.textContent = observacion.analista || '-';
            if (docOpsMotivoLabel) docOpsMotivoLabel.textContent = getMotivoDecisionLabel(tipoDecision, 'operaciones');
            if (docOpsMotivo) docOpsMotivo.textContent = observacion.motivo || '-';
            if (docOpsFechaHora) docOpsFechaHora.textContent = observacion.fechaHora || '-';
            if (docOpsComentarioAnalista) docOpsComentarioAnalista.textContent = observacion.comentario || '-';
        }

        if (btnResponderObservacionOperaciones) {
            const respuestaPermitida = isOperacionesRespuestaPermitida(currentDocumentariaSolicitud);
            const respuestaEnviada = isOperacionesRespuestaEnviada() && respuestaPermitida;
            btnResponderObservacionOperaciones.disabled = !respuestaPermitida || respuestaEnviada;
            btnResponderObservacionOperaciones.hidden = !respuestaPermitida || respuestaEnviada;
            btnResponderObservacionOperaciones.title = respuestaEnviada
                ? 'La respuesta ya fue enviada a operaciones.'
                : 'Habilitar campo para responder la observación.';
        }
    }

    function updateChecklist2ComentarioState() {
        if (!docChecklist2Comentario) return;
        const texto = docChecklist2Comentario.value.slice(0, 250);
        if (texto !== docChecklist2Comentario.value) docChecklist2Comentario.value = texto;
        docChecklist2ComentarioValue = texto;

        if (docChecklist2ComentarioCounter) {
            docChecklist2ComentarioCounter.textContent = `${texto.length}/250`;
        }

        const isOperaciones = isOperacionesObservadoSolicitud(currentDocumentariaSolicitud);
        const respuestaPermitida = isOperacionesRespuestaPermitida(currentDocumentariaSolicitud);
        const respuestaHabilitada = respuestaPermitida && isOperacionesRespuestaHabilitada();
        const respuestaEnviada = respuestaPermitida && isOperacionesRespuestaEnviada();
        const ocultarRespuestaOperaciones = isOperaciones && (!respuestaPermitida || (!respuestaHabilitada && !respuestaEnviada));
        const comentarioReadonly = isChecklist2ReadOnly || (isOperaciones && (!respuestaPermitida || !respuestaHabilitada));

        const comentarioWrapper = document.getElementById('docChecklist2CommentWrapper');
        if (comentarioWrapper) {
            comentarioWrapper.hidden = ocultarRespuestaOperaciones;
        }

        docChecklist2Comentario.readOnly = comentarioReadonly;
        docChecklist2Comentario.classList.toggle('is-readonly', comentarioReadonly);
        docChecklist2Comentario.placeholder = comentarioReadonly
            ? (isOperaciones ? 'Respuesta enviada a operaciones' : 'Comentario enviado a operaciones')
            : (isOperaciones ? 'Ingrese respuesta para operaciones' : 'Ingrese comentario para operaciones');

        if (docChecklist2ComentarioLabel) {
            docChecklist2ComentarioLabel.textContent = isOperaciones ? 'Respuesta a operaciones' : 'Comentario';
        }

        if (respuestaEnviada) {
            docChecklist2Comentario.placeholder = 'Respuesta enviada a operaciones';
        }
    }

    function areAllPostAprobacionDocsDownloaded() {
        const docNames = getPostAprobacionDocNames();
        return docNames.length > 0 && docNames.every(docName => downloadedPostAprobacionDocs.has(docName));
    }

    function isChecklist2Unlocked() {
        return areAllPostAprobacionDocsDownloaded()
            || !!(currentDocumentariaSolicitud && currentDocumentariaSolicitud.documentariaEnviadaOperaciones)
            || isOperacionesObservadoSolicitud(currentDocumentariaSolicitud);
    }

    function isSolicitudEnFirma(solicitud) {
        return String(solicitud?.etapa || '').toUpperCase() === 'FIRMA';
    }

    function normalizarEtapa(etapa) {
        return String(etapa || '')
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function debeMostrarEstadoDesdeRiesgos(etapa) {
        return ['RIESGOS', 'DOCUMENTARIA', 'FIRMA', 'FIRMAS', 'OPERACIONES', 'ACTIVACION'].includes(normalizarEtapa(etapa));
    }

    function actualizarEstadoDocumentariaResumen(solicitud) {
        const docEstadoWrapper = document.getElementById('docEstadoWrapper');
        const docEstado = document.getElementById('docEstado');
        if (!docEstadoWrapper || !docEstado || !solicitud) return;

        const mostrarEstado = debeMostrarEstadoDesdeRiesgos(solicitud.etapa);
        docEstadoWrapper.hidden = !mostrarEstado;
        docEstadoWrapper.style.display = mostrarEstado ? 'flex' : 'none';
        if (mostrarEstado) {
            docEstado.textContent = solicitud.estado || '-';
        }
    }

    function actualizarEstadoRegistroResumen(solicitud) {
        const regEtapaWrapper = document.getElementById('regEtapaWrapper');
        const regEstadoWrapper = document.getElementById('regEstadoWrapper');
        const regEtapa = document.getElementById('regEtapa');
        const regEstado = document.getElementById('regEstado');
        const regFechaSimulacion = document.getElementById('regFechaSimulacion');
        if (!regEtapaWrapper || !regEstadoWrapper || !regEtapa || !regEstado || !solicitud) return;

        regEtapaWrapper.hidden = false;
        regEstadoWrapper.hidden = false;
        regEtapaWrapper.style.display = 'block';
        regEstadoWrapper.style.display = 'block';
        regEtapa.textContent = solicitud.etapa || '-';
        regEstado.textContent = solicitud.estado || 'PENDIENTE';
        if (regFechaSimulacion) {
            regFechaSimulacion.textContent = solicitud.fecha || regFechaSimulacion.textContent || '-';
        }
        renderStageNavigation('registroStageTabs', solicitud.etapa || 'SOLICITUD', solicitud.estado || 'PENDIENTE', 'SOLICITUD');
    }

    function updateDocumentariaTitleAndStage() {
        if (!currentDocumentariaSolicitud) return;
        const etapaNormalizada = normalizarEtapa(currentDocumentariaSolicitud.etapa);
        const isOperaciones = isOperacionesObservadoSolicitud(currentDocumentariaSolicitud) || etapaNormalizada === 'OPERACIONES' || etapaNormalizada === 'ACTIVACION';
        const isFirma = isSolicitudEnFirma(currentDocumentariaSolicitud);
        const docEtapa = document.getElementById('docEtapa');

        if (documentariaPageTitle) {
            documentariaPageTitle.textContent = isOperaciones ? 'Operaciones' : (isFirma ? 'Firmas' : 'Bandeja documentaria');
        }
        if (docEtapa) {
            docEtapa.textContent = etapaNormalizada === 'ACTIVACION' ? 'OPERACIONES' : (currentDocumentariaSolicitud.etapa || 'DOCUMENTARIA');
        }
        actualizarEstadoDocumentariaResumen(currentDocumentariaSolicitud);
        renderStageNavigation('documentariaStageTabs', currentDocumentariaSolicitud.etapa || 'DOCUMENTARIA', currentDocumentariaSolicitud.estado || 'PENDIENTE', getEtapaNavigationKey(currentDocumentariaSolicitud.etapa || 'DOCUMENTARIA'));
        updateGenerarContratoGarantiaButtonState();
    }

    function avanzarSolicitudEFE004AFirmaPendiente() {
        if (!isSolicitudFirmaAutomatica(currentDocumentariaSolicitud)) return;
        if (!areAllPostAprobacionDocsDownloaded()) return;

        currentDocumentariaSolicitud.etapa = 'FIRMA';
        if (!docChecklist2Docs.length) {
            currentDocumentariaSolicitud.estado = 'PENDIENTE';
        }
        updateDocumentariaTitleAndStage();
        saveSolicitudFirmaAutomaticaState(currentDocumentariaSolicitud);
    }

    function actualizarEstadoFirmaChecklist2(solicitud) {
        if (!isSolicitudFirmaAutomatica(solicitud) || !isSolicitudEnFirma(solicitud)) return;
        const tieneChecklist2 = Array.isArray(solicitud.checklist2Docs) && solicitud.checklist2Docs.length > 0;
        solicitud.estado = tieneChecklist2 ? 'EN PROCESO' : 'PENDIENTE';
    }

    function updatePostAprobacionDownloadVisuals() {
        getPostAprobacionDownloadButtons().forEach(btn => {
            const downloaded = downloadedPostAprobacionDocs.has(btn.dataset.docName);
            btn.classList.toggle('is-downloaded', downloaded);
            btn.setAttribute('data-downloaded', String(downloaded));
        });
    }

    function updatePostAprobacionCollapseState() {
        const allDownloaded = areAllPostAprobacionDocsDownloaded();

        if (!allDownloaded) {
            postAprobacionCollapsed = false;
        } else if (!docPostAprobacionCard || !docPostAprobacionCard.classList.contains('is-completed')) {
            postAprobacionCollapsed = true;
        }

        if (docPostAprobacionCard) {
            docPostAprobacionCard.classList.toggle('is-completed', allDownloaded);
            docPostAprobacionCard.classList.toggle('is-collapsed', allDownloaded && postAprobacionCollapsed);
        }

        if (docPostAprobacionList) {
            docPostAprobacionList.hidden = allDownloaded && postAprobacionCollapsed;
        }

        if (btnDescargarTodosDocs) {
            btnDescargarTodosDocs.hidden = allDownloaded;
        }

        if (btnVerMasPostDocs) {
            btnVerMasPostDocs.hidden = !allDownloaded;
            const icon = btnVerMasPostDocs.querySelector('.material-icons-outlined');
            if (allDownloaded && postAprobacionCollapsed) {
                btnVerMasPostDocs.lastChild.textContent = 'Ver más';
                if (icon) icon.textContent = 'expand_more';
            } else {
                btnVerMasPostDocs.lastChild.textContent = 'Ver menos';
                if (icon) icon.textContent = 'expand_less';
            }
        }
    }

    function updateChecklist2Availability() {
        const unlocked = isChecklist2Unlocked();

        if (docChecklist2Card) {
            docChecklist2Card.classList.toggle('is-locked', !unlocked);
            docChecklist2Card.classList.toggle('is-unlocked', unlocked);
            docChecklist2Card.classList.toggle('is-readonly', isChecklist2ReadOnly);
        }
        if (docChecklist2Subtitle) {
            docChecklist2Subtitle.hidden = !unlocked;
            docChecklist2Subtitle.textContent = isChecklist2ReadOnly
                ? 'Documentos enviados a operaciones. Solo se permite ver o descargar.'
                : 'Adjunta los documentos PDF requeridos para la etapa documentaria.';
        }
        if (docChecklist2Counter) docChecklist2Counter.hidden = !unlocked;
        if (docChecklist2Content) docChecklist2Content.hidden = !unlocked;
        updateOperacionesObservationState();
        updateChecklist2ComentarioState();

        if (!unlocked && docChecklist2Body) {
            docChecklist2Body.innerHTML = '';
        }
        updateChecklist2SendButtonState();
    }

    function updateChecklist2SendButtonState() {
        const unlocked = isChecklist2Unlocked();
        const tieneDocumentos = docChecklist2Docs.length > 0;
        const isOperaciones = isOperacionesObservadoSolicitud(currentDocumentariaSolicitud);
        const respuestaPermitida = isOperacionesRespuestaPermitida(currentDocumentariaSolicitud);
        const respuestaHabilitada = respuestaPermitida && isOperacionesRespuestaHabilitada();
        const respuestaEnviada = respuestaPermitida && isOperacionesRespuestaEnviada();

        let enviarOperacionesDeshabilitado = !unlocked || !tieneDocumentos || isChecklist2ReadOnly;
        if (isOperaciones) {
            enviarOperacionesDeshabilitado = !respuestaPermitida || !unlocked || !tieneDocumentos || respuestaEnviada || !respuestaHabilitada;
        }

        if (docChecklist2Footer) {
            docChecklist2Footer.hidden = isOperaciones ? !respuestaPermitida : enviarOperacionesDeshabilitado;
        }

        if (btnEnviarOperacionesChecklist2) {
            btnEnviarOperacionesChecklist2.disabled = enviarOperacionesDeshabilitado;
            btnEnviarOperacionesChecklist2.setAttribute('aria-disabled', String(enviarOperacionesDeshabilitado));
            btnEnviarOperacionesChecklist2.title = respuestaEnviada
                ? 'La respuesta ya fue enviada a operaciones.'
                : (isOperaciones && !respuestaPermitida
                    ? 'La solicitud rechazada no permite respuesta.'
                    : (isOperaciones && !respuestaHabilitada
                        ? 'Seleccione Responder para habilitar el envío.'
                        : (tieneDocumentos ? 'Enviar documentos a operaciones' : 'Adjunte al menos un documento para enviar a operaciones')));
        }
    }

    function mostrarPopupDocumentosPostAprobacionCompletos() {
        modalTitle.textContent = 'Descarga completada';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-solicitud-text">Todos los documentos descargados continúa con etapa de firmas</p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function syncDocumentariaDownloadFlow() {
        updatePostAprobacionDownloadVisuals();
        updatePostAprobacionCollapseState();
        updateChecklist2Availability();
        if (isChecklist2Unlocked()) {
            renderDocChecklist2();
            if (!postAprobacionCompletionPopupShown && areAllPostAprobacionDocsDownloaded()) {
                postAprobacionCompletionPopupShown = true;
                avanzarSolicitudEFE004AFirmaPendiente();
                persistCurrentDocumentariaState();
                mostrarPopupDocumentosPostAprobacionCompletos();
            } else if (areAllPostAprobacionDocsDownloaded()) {
                avanzarSolicitudEFE004AFirmaPendiente();
            }
        }
        persistCurrentDocumentariaState();
    }

    function markPostAprobacionDocDownloaded(docName) {
        if (!docName) return;
        downloadedPostAprobacionDocs.add(docName);
        syncDocumentariaDownloadFlow();
    }

    function descargarDocumentoChecklist2(doc) {
        if (!doc) return;
        console.log(`Descarga solicitada de CheckList 2: ${doc.name}`);
        showToast(`Descarga solicitada: ${doc.name}`, 'success');
    }

    function renderDocChecklist2() {
        if (!docChecklist2Body || !isChecklist2Unlocked()) return;

        docChecklist2Body.innerHTML = '';

        docChecklist2Docs.forEach((doc, index) => {
            const row = document.createElement('tr');
            const acciones = isChecklist2ReadOnly ? `
                        <button type="button" class="doc-checklist2-icon-btn" data-doc-checklist2-action="ver" data-index="${index}" title="Ver documento" aria-label="Ver documento">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                        <button type="button" class="doc-checklist2-download-btn" data-doc-checklist2-action="descargar" data-index="${index}">
                            <span class="material-icons-outlined">download</span>
                            Descargar
                        </button>
            ` : `
                        <button type="button" class="doc-checklist2-icon-btn" data-doc-checklist2-action="ver" data-index="${index}" title="Ver documento" aria-label="Ver documento">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                        <button type="button" class="doc-checklist2-edit-btn" data-doc-checklist2-action="editar" data-index="${index}">Editar</button>
                        <button type="button" class="doc-checklist2-icon-btn danger" data-doc-checklist2-action="eliminar" data-index="${index}" title="Eliminar documento" aria-label="Eliminar documento">
                            <span class="material-icons-outlined">delete</span>
                        </button>
            `;

            row.innerHTML = `
                <td>
                    <div class="documentaria-checklist2-file">
                        <span class="material-icons-outlined">picture_as_pdf</span>
                        <span>${escapeHtml(doc.name)}</span>
                    </div>
                </td>
                <td>
                    <div class="documentaria-checklist2-actions">
                        ${acciones}
                    </div>
                </td>
            `;
            docChecklist2Body.appendChild(row);
        });

        if (!isChecklist2ReadOnly && docChecklist2Docs.length < DOC_CHECKLIST2_MAX) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `
                <td class="documentaria-checklist2-empty">Adjuntar documento</td>
                <td>
                    <button type="button" class="doc-checklist2-upload-btn" data-doc-checklist2-action="adjuntar">
                        <span class="material-icons-outlined">upload_file</span>
                        Adjuntar documento
                    </button>
                </td>
            `;
            docChecklist2Body.appendChild(emptyRow);
        } else if (!isChecklist2ReadOnly && docChecklist2Docs.length >= DOC_CHECKLIST2_MAX) {
            const limitRow = document.createElement('tr');
            limitRow.innerHTML = `
                <td colspan="2" class="documentaria-checklist2-limit">Límite máximo de 15 documentos alcanzado.</td>
            `;
            docChecklist2Body.appendChild(limitRow);
        }

        if (docChecklist2Counter) {
            docChecklist2Counter.textContent = `${docChecklist2Docs.length}/${DOC_CHECKLIST2_MAX} documentos`;
        }
        updateChecklist2ComentarioState();

        updateChecklist2SendButtonState();

        docChecklist2Body.querySelectorAll('[data-doc-checklist2-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.docChecklist2Action;
                const index = Number(btn.dataset.index);

                if (action === 'adjuntar') {
                    if (isChecklist2ReadOnly) return;
                    if (!isChecklist2Unlocked()) return;
                    if (docChecklist2Docs.length >= DOC_CHECKLIST2_MAX) return;
                    docNameContext = 'checklist2';
                    editingChecklist2Index = null;
                    pendingChecklist2FileObject = null;
                    if (docChecklist2FileInput) docChecklist2FileInput.click();
                    return;
                }

                if (action === 'ver') {
                    const doc = docChecklist2Docs[index];
                    if (!doc) return;
                    modalTitle.textContent = `Visualizar - ${doc.name}`;
                    modalBody.innerHTML = `
                        <div style="background-color: #f1f3f5; border: 1px solid var(--border-color); border-radius: 8px; height: 350px; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; color: var(--text-secondary);">
                            <span class="material-icons-outlined" style="font-size: 64px; color: var(--primary-blue);">picture_as_pdf</span>
                            <p style="font-weight: 600;">[ Simulación de Visor PDF ]</p>
                            <p style="font-size: 0.8rem;">Archivo: ${escapeHtml(doc.name)}</p>
                        </div>
                    `;
                    document.getElementById('modalBtnCancel').textContent = 'Cerrar';
                    document.getElementById('modalBtnCancel').style.display = 'inline-flex';
                    document.getElementById('modalBtnAction').style.display = 'none';
                    modalOverlay.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    return;
                }

                if (action === 'descargar') {
                    const doc = docChecklist2Docs[index];
                    descargarDocumentoChecklist2(doc);
                    return;
                }

                if (action === 'editar') {
                    if (isChecklist2ReadOnly) return;
                    const doc = docChecklist2Docs[index];
                    if (!doc) return;
                    docNameContext = 'checklist2';
                    editingChecklist2Index = index;
                    pendingChecklist2FileObject = null;
                    if (docChecklist2FileInput) docChecklist2FileInput.click();
                    return;
                }

                if (action === 'eliminar') {
                    if (isChecklist2ReadOnly) return;
                    if (!docChecklist2Docs[index]) return;
                    docChecklist2Docs.splice(index, 1);
                    if (currentDocumentariaSolicitud) {
                        currentDocumentariaSolicitud.checklist2Docs = docChecklist2Docs;
                        actualizarEstadoFirmaChecklist2(currentDocumentariaSolicitud);
                        updateDocumentariaTitleAndStage();
                    }
                    persistCurrentDocumentariaState();
                    renderDocChecklist2();
                    showToast('Documento eliminado del CheckList 2.', 'info');
                }
            });
        });
    }

    function volverABandejaEntradaDesdeDocumentaria() {
        stageNavigationEnabledForCurrentFlow = false;
        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        document.getElementById('moduloBandeja').classList.add('active');
        navItems.forEach(n => n.classList.remove('active'));
        if (document.getElementById('navBandeja')) document.getElementById('navBandeja').classList.add('active');
        renderBandejaNewTable(filteredBandejaData);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function mostrarPopupExitoEnviarOperaciones() {
        modalTitle.textContent = 'Envío exitoso';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-solicitud-text">La documentación fue enviada a operaciones correctamente.</p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
            volverABandejaEntradaDesdeDocumentaria();
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function enviarChecklist2AOperaciones() {
        if (!currentDocumentariaSolicitud || docChecklist2Docs.length === 0 || isChecklist2ReadOnly) return;

        if (docChecklist2Comentario) {
            docChecklist2ComentarioValue = docChecklist2Comentario.value.slice(0, 250);
        }
        const esRespuestaOperaciones = isOperacionesRespuestaPermitida(currentDocumentariaSolicitud);
        if (isOperacionesObservadoSolicitud(currentDocumentariaSolicitud) && !esRespuestaOperaciones) return;
        if (esRespuestaOperaciones && !docChecklist2ComentarioValue.trim()) {
            showToast('Ingrese un comentario para responder a Operaciones.', 'warning');
            if (docChecklist2Comentario) docChecklist2Comentario.focus();
            return;
        }

        currentDocumentariaSolicitud.documentariaEnviadaOperaciones = true;
        currentDocumentariaSolicitud.checklist2Docs = docChecklist2Docs;
        currentDocumentariaSolicitud.checklist2Comentario = docChecklist2ComentarioValue;
        currentDocumentariaSolicitud.downloadedPostAprobacionDocs = Array.from(downloadedPostAprobacionDocs);
        currentDocumentariaSolicitud.contratoGarantiaGenerado = contratoGarantiaGenerado;
        currentDocumentariaSolicitud.etapa = 'OPERACIONES';
        currentDocumentariaSolicitud.estado = esRespuestaOperaciones ? currentDocumentariaSolicitud.estado : 'PENDIENTE';
        updateDocumentariaTitleAndStage();
        if (esRespuestaOperaciones) {
            registrarRespuestaEjecutivoSolicitud(currentDocumentariaSolicitud, 'operaciones', docChecklist2ComentarioValue, formatFechaHoraActual());
            currentDocumentariaSolicitud.operacionesRespuestaEnviada = true;
            currentDocumentariaSolicitud.operacionesRespuestaHabilitada = false;
        }
        isChecklist2ReadOnly = true;
        persistCurrentDocumentariaState();
        updateChecklist2Availability();
        renderDocChecklist2();
        mostrarPopupExitoEnviarOperaciones();
    }

    function mostrarPopupConfirmacionEnviarOperaciones() {
        if (!btnEnviarOperacionesChecklist2 || btnEnviarOperacionesChecklist2.disabled) return;

        modalTitle.textContent = 'Confirmar envío a operaciones';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">help_outline</span>
                </div>
                <p class="popup-solicitud-text">¿Está seguro de enviar la documentación a operaciones?</p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'inline-flex';
        document.getElementById('modalBtnCancel').textContent = 'Cancelar';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', enviarChecklist2AOperaciones);

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    if (btnEnviarOperacionesChecklist2) {
        btnEnviarOperacionesChecklist2.addEventListener('click', mostrarPopupConfirmacionEnviarOperaciones);
    }

    if (btnResponderObservacionOperaciones) {
        btnResponderObservacionOperaciones.addEventListener('click', () => {
            if (!isOperacionesRespuestaPermitida(currentDocumentariaSolicitud) || isOperacionesRespuestaEnviada()) return;
            currentDocumentariaSolicitud.operacionesRespuestaHabilitada = true;
            updateOperacionesObservationState();
            updateChecklist2ComentarioState();
            updateChecklist2SendButtonState();
            if (docChecklist2Comentario) {
                docChecklist2Comentario.focus();
            }
            persistCurrentDocumentariaState();
        });
    }

    if (btnResponderObservacionRiesgos) {
        btnResponderObservacionRiesgos.addEventListener('click', () => {
            const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
            if (!isRiesgosObservadoSolicitud(solicitudActual) || solicitudActual.riesgosRespuestaEnviada) return;
            solicitudActual.riesgosRespuestaHabilitada = true;
            updateRiesgosRespuestaState(solicitudActual, true);
            if (regRespuestaRiesgosComentario) regRespuestaRiesgosComentario.focus();
        });
    }

    if (regRespuestaRiesgosComentario) {
        regRespuestaRiesgosComentario.addEventListener('input', () => {
            regRespuestaRiesgosComentario.value = regRespuestaRiesgosComentario.value.replace(/^\s+/, '').slice(0, 250);
            updateRiesgosRespuestaCounter();
        });
    }

    if (docChecklist2Comentario) {
        docChecklist2Comentario.addEventListener('input', () => {
            if (isChecklist2ReadOnly) {
                docChecklist2Comentario.value = docChecklist2ComentarioValue;
                updateChecklist2ComentarioState();
                return;
            }
            updateChecklist2ComentarioState();
            persistCurrentDocumentariaState();
        });
    }

    if (docChecklist2FileInput) {
        docChecklist2FileInput.addEventListener('change', (e) => {
            if (isChecklist2ReadOnly) {
                docChecklist2FileInput.value = '';
                return;
            }
            if (!isChecklist2Unlocked()) {
                docChecklist2FileInput.value = '';
                return;
            }
            if (e.target.files.length === 0) return;

            const file = e.target.files[0];
            if (!isPdfFile(file)) {
                showToast('Solo se permite adjuntar documentos PDF.', 'warning');
                docChecklist2FileInput.value = '';
                pendingChecklist2FileObject = null;
                return;
            }

            docNameContext = 'checklist2';
            pendingChecklist2FileObject = file;
            inputDocName.value = file.name.replace(/\.[^/.]+$/, '');
            modalDocNameOverlay.classList.add('active');
            inputDocName.focus();
        });
    }

    // Modal save document name handler
    btnSaveDocName.addEventListener('click', () => {
        const docNameValue = inputDocName.value.trim();
        if (!docNameValue) {
            showToast('Debe escribir un nombre descriptivo para el documento.', 'warning');
            return;
        }

        // Ensure .pdf extension
        const finalName = docNameValue.toLowerCase().endsWith('.pdf') ? docNameValue : docNameValue + '.pdf';

        if (docNameContext === 'checklist2') {
            if (isChecklist2ReadOnly) {
                showToast('La solicitud ya fue enviada a operaciones. Solo se permite visualizar o descargar.', 'warning');
                return;
            }
            if (!pendingChecklist2FileObject) {
                showToast('Debe seleccionar un documento PDF para registrarlo.', 'warning');
                return;
            }

            if (editingChecklist2Index !== null) {
                docChecklist2Docs[editingChecklist2Index] = {
                    ...docChecklist2Docs[editingChecklist2Index],
                    name: finalName,
                    file: pendingChecklist2FileObject
                };
                showToast('Documento actualizado en CheckList 2.', 'success');
            } else {
                if (docChecklist2Docs.length >= DOC_CHECKLIST2_MAX) {
                    showToast('Solo se permite adjuntar hasta 15 documentos.', 'warning');
                    return;
                }

                docChecklist2Docs.push({
                    id: 'DOC-CL2-' + Date.now(),
                    name: finalName,
                    file: pendingChecklist2FileObject
                });
                showToast('Documento adjuntado en CheckList 2.', 'success');
            }

            currentDocumentariaSolicitud.checklist2Docs = docChecklist2Docs;
            actualizarEstadoFirmaChecklist2(currentDocumentariaSolicitud);
            updateDocumentariaTitleAndStage();

            modalDocNameOverlay.classList.remove('active');
            if (docChecklist2FileInput) docChecklist2FileInput.value = '';
            pendingChecklist2FileObject = null;
            editingChecklist2Index = null;
            docNameContext = null;
            persistCurrentDocumentariaState();
            renderDocChecklist2();
            return;
        }

        if (editingDocId !== null) {
            // Edit mode
            attachedDocs[editingDocId].name = finalName;
            showToast('Nombre de documento actualizado.', 'success');
        } else {
            // Add mode
            attachedDocs.push({
                id: 'DOC-' + Date.now(),
                name: finalName,
                file: pendingFileObject
            });
            showToast('Documento adjuntado.', 'success');
        }

        modalDocNameOverlay.classList.remove('active');
        if (inputHiddenFile) inputHiddenFile.value = '';
        pendingFileObject = null;
        editingDocId = null;
        docNameContext = null;
        renderChecklistTable();
    });

    // Modal cancel document name handler
    btnCancelDocName.addEventListener('click', () => {
        modalDocNameOverlay.classList.remove('active');
        if (inputHiddenFile) inputHiddenFile.value = '';
        if (docChecklist2FileInput) docChecklist2FileInput.value = '';
        pendingFileObject = null;
        editingDocId = null;
        pendingChecklist2FileObject = null;
        editingChecklist2Index = null;
        docNameContext = null;
    });

    function clearCelularSolicitudHighlight() {
        const regCelular = document.getElementById('regCelular');
        if (!regCelular) return;
        regCelular.classList.remove('input-attention');
        const group = regCelular.closest('.form-group');
        if (group) group.classList.remove('field-attention');
        regCelular.setCustomValidity('');
    }

    function resaltarCelularSolicitud() {
        const regCelular = document.getElementById('regCelular');
        if (!regCelular) return;
        const group = regCelular.closest('.form-group');
        regCelular.classList.remove('input-attention');
        if (group) group.classList.remove('field-attention');
        void regCelular.offsetWidth;
        regCelular.classList.add('input-attention');
        if (group) group.classList.add('field-attention');
        regCelular.scrollIntoView({ behavior: 'smooth', block: 'center' });
        regCelular.focus({ preventScroll: true });
        regCelular.setCustomValidity('Ingrese el número de celular para enviar la URL de políticas de privacidad.');
    }

    function validarCelularSolicitud() {
        const regCelular = document.getElementById('regCelular');
        if (!regCelular) return true;
        const celular = regCelular.value.trim();
        if (!celular) {
            resaltarCelularSolicitud();
            showToast('Debe ingresar el número de celular para enviar la URL de políticas de privacidad.', 'warning');
            return false;
        }
        clearCelularSolicitudHighlight();
        return true;
    }

    function mostrarPopupPoliticasPrivacidadSolicitud(telefono, onConfirm) {
        modalTitle.textContent = 'Políticas de privacidad';
        modalBody.innerHTML = `
            <div class="popup-politicas-confirmacion">
                <div class="popup-politicas-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-politicas-text">
                    El número ingresado se enviará la URL de políticas de privacidad.
                </p>
                <p class="popup-politicas-text">
                    Número de celular: <strong>${telefono}</strong>
                </p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
            if (typeof onConfirm === 'function') onConfirm();
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function ejecutarEnvioARiesgos() {
        saveCurrentRegistrationState();
        const celular = document.getElementById('regCelular').value.trim();
        const tipoDoc = document.getElementById('regTipoDoc').value;
        const nroDoc = document.getElementById('regNroDoc').value;
        const celularText = celular;
        const comentarioRegistro = document.getElementById('regComentarios')?.value || '';

        // Generate current timestamp matching the format dd-mm-yyyy hh:mm:ss
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const fechaStr = `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;

        const capitalizeWord = (str) => {
            if (!str) return '';
            return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        };
        const concesionarioStr = capitalizeWord(document.getElementById('regVehConcesionario').value) || 'Hyundai';
        const tiendaStr = capitalizeWord(document.getElementById('regVehTienda').value) || 'Puruchuco';

        // Update the existing request in solicitudes, or add new if not found
        const solId = document.getElementById('regSolicitudId').textContent;
        const existingSol = solicitudes.find(s => s.id === solId);
        if (existingSol) {
            const esReenvioPorObservacionRiesgos = isRiesgosObservadoSolicitud(existingSol);
            existingSol.fecha = fechaStr;
            existingSol.etapa = 'RIESGOS';
            existingSol.estado = 'PENDIENTE';
            existingSol.telefono = celularText;
            existingSol.concesionario = concesionarioStr;
            existingSol.tienda = tiendaStr;
            existingSol.vendedorTipoDoc = document.getElementById('regVehTipoDocVendedor')?.value || existingSol.vendedorTipoDoc;
            existingSol.vendedorNroDoc = document.getElementById('regVehNroDocVendedor')?.value || existingSol.vendedorNroDoc;
            existingSol.vendedor = document.getElementById('regVehVendedor')?.value || existingSol.vendedor;
            existingSol.tipoCambio = document.getElementById('regSimTipoCambio')?.value || existingSol.tipoCambio;
            existingSol.documentos = [...attachedDocs];
            existingSol.chkManualDni = document.getElementById('chkManualDni')?.checked || false;
            existingSol.chkManualRecibo = document.getElementById('chkManualRecibo')?.checked || false;
            existingSol.chkManualCotizacion = document.getElementById('chkManualCotizacion')?.checked || false;
            existingSol.registroEditableData = collectRegistroEditableData();
            existingSol.gastosRegistrales = document.getElementById('regGastosRegistrales')?.value || existingSol.gastosRegistrales;
            existingSol.gastosDelivery = document.getElementById('regGastosDelivery')?.value || existingSol.gastosDelivery;
            existingSol.cuotasDobles = document.getElementById('regCuotasDobles')?.value || existingSol.cuotasDobles;
            existingSol.mesesCuotasDobles = document.getElementById('regMesesCuotasDobles')?.value || existingSol.mesesCuotasDobles;
            existingSol.seguroVehicular = document.getElementById('regSegVehicular')?.value || existingSol.seguroVehicular;
            existingSol.costoSeguroVehicular = document.getElementById('regSegVehCosto')?.value || existingSol.costoSeguroVehicular;
            existingSol.seguroDesgravamen = document.getElementById('regSegDesgravamen')?.value || existingSol.seguroDesgravamen;
            existingSol.tipoSeguroDesgravamen = document.getElementById('regSegDesgProd')?.value || existingSol.tipoSeguroDesgravamen;
            if (esReenvioPorObservacionRiesgos) {
                registrarRespuestaEjecutivoSolicitud(existingSol, 'riesgos', comentarioRegistro, fechaStr);
                existingSol.respuestaRiesgosBorrador = '';
                existingSol.riesgosRespuestaEnviada = true;
                existingSol.riesgosRespuestaHabilitada = false;
            } else {
                registrarComentarioEjecutivoSolicitud(existingSol, comentarioRegistro, fechaStr);
            }
            
            // Set the correct calculated amount from the form
            const precioVehStr = document.getElementById('regSimPrecioVeh').value;
            if (precioVehStr) {
                existingSol.monto = precioVehStr.replace('$', 'S/');
            }
        } else {
            const newSol = {
                id: solId,
                cliente: 'Juan Pérez García',
                documento: `${tipoDoc} - ${nroDoc}`,
                tipoCredito: 'Crédito vehicular',
                monto: 'S/ 21,480.00',
                fecha: fechaStr,
                estado: 'PENDIENTE',
                etapa: 'RIESGOS',
                telefono: celularText,
                concesionario: concesionarioStr,
                tienda: tiendaStr,
                vendedorTipoDoc: document.getElementById('regVehTipoDocVendedor')?.value || 'DNI',
                vendedorNroDoc: document.getElementById('regVehNroDocVendedor')?.value || '',
                vendedor: document.getElementById('regVehVendedor')?.value || 'ALOCHA',
                tipoCambio: document.getElementById('regSimTipoCambio')?.value || getTipoCambioCalculoValue(),
                documentos: [...attachedDocs],
                chkManualDni: document.getElementById('chkManualDni')?.checked || false,
                chkManualRecibo: document.getElementById('chkManualRecibo')?.checked || false,
                chkManualCotizacion: document.getElementById('chkManualCotizacion')?.checked || false,
                registroEditableData: collectRegistroEditableData(),
                gastosRegistrales: document.getElementById('regGastosRegistrales')?.value || 'S/ 0.00',
                gastosDelivery: document.getElementById('regGastosDelivery')?.value || 'S/ 0.00',
                cuotasDobles: document.getElementById('regCuotasDobles')?.value || 'No',
                mesesCuotasDobles: document.getElementById('regMesesCuotasDobles')?.value || '',
                seguroVehicular: document.getElementById('regSegVehicular')?.value || getSeguroVehicularCalculoValue(),
                costoSeguroVehicular: document.getElementById('regSegVehCosto')?.value || getCostoSeguroVehicularCalculoValue(),
                seguroDesgravamen: document.getElementById('regSegDesgravamen')?.value || getSeguroDesgravamenCalculoValue(),
                tipoSeguroDesgravamen: document.getElementById('regSegDesgProd')?.value || getTipoSeguroDesgravamenCalculoValue()
            };
            registrarComentarioEjecutivoSolicitud(newSol, comentarioRegistro, fechaStr);
            solicitudes.unshift(newSol);
        }

        actualizarEstadoRegistroResumen(solicitudes.find(s => s.id === solId) || { etapa: 'RIESGOS', estado: 'PENDIENTE' });

        // Navigate to Bandeja
        stageNavigationEnabledForCurrentFlow = false;
        document.querySelectorAll('.module-page').forEach(page => page.classList.remove('active'));
        document.getElementById('moduloBandeja').classList.add('active');
        
        navItems.forEach(n => n.classList.remove('active'));
        document.getElementById('navBandeja').classList.add('active');
        
        // Re-render table with new item
        applyBandejaFilters();

        mostrarPopupEnvioRiesgos();
    }

    // Pasar a Riesgos sin validación OTP
    document.getElementById('btnPasarRiesgos').addEventListener('click', () => {
        const solicitudActual = solicitudes.find(s => s.id === currentSolicitudId);
        if (isRiesgosObservadoSolicitud(solicitudActual) && !isRiesgosObservadoEditableSolicitud(solicitudActual)) {
            enviarRespuestaARiesgos();
            return;
        }

        if (isSolicitudRechazada(solicitudActual)) {
            return;
        }

        if (!validarCelularSolicitud()) return;

        const celular = document.getElementById('regCelular').value.trim();
        if (isRiesgosObservadoEditableSolicitud(solicitudActual)) {
            ejecutarEnvioARiesgos();
            return;
        }

        mostrarPopupPoliticasPrivacidadSolicitud(celular, ejecutarEnvioARiesgos);
    });

    function mostrarPopupEnvioRiesgos() {
        modalTitle.textContent = 'Envío exitoso';
        modalBody.innerHTML = `
            <div class="popup-solicitud-success">
                <div class="popup-solicitud-icon">
                    <span class="material-icons-outlined">check_circle</span>
                </div>
                <p class="popup-solicitud-text">Se envió a Riesgos con éxito, espere atento para su revisión.</p>
            </div>
        `;

        document.getElementById('modalBtnCancel').style.display = 'none';
        document.getElementById('modalBtnAction').style.display = 'inline-flex';
        document.getElementById('modalBtnAction').textContent = 'Aceptar';

        const oldActionBtn = document.getElementById('modalBtnAction');
        const newActionBtn = oldActionBtn.cloneNode(true);
        oldActionBtn.parentNode.replaceChild(newActionBtn, oldActionBtn);
        newActionBtn.addEventListener('click', () => {
            closeModal();
            document.getElementById('modalBtnCancel').style.display = 'inline-flex';
        });

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Recalcular capacidad button moved to Cálculo screen

    // Limpiar button
    btnLimpiar.addEventListener('click', () => {
        nroDocumento.value = '';
        nroTelefono.value = '';
        if (simPrecioVehiculoUsd) simPrecioVehiculoUsd.value = '';
        if (calcTelefonoPoliticas) {
            calcTelefonoPoliticas.value = '';
            clearTelefonoPoliticasHighlight();
        }
        tipoDocumento.value = 'DNI';
        toggleConyuge.checked = false;
        conyugeData.style.display = 'none';
        labelNo.classList.add('active-label');
        labelSi.classList.remove('active-label');
        document.getElementById('tipoDocConyuge').value = 'DNI';
        document.getElementById('nroDocConyuge').value = '';
        btnSimular.disabled = true;
        btnSimular.classList.remove('enabled');
        updateContinuarDesdeCalculoState();
        showToast('Formulario limpiado correctamente.', 'info');
    });

    // ========================================
    // BANDEJA DE ENTRADA REDESIGNED — Table & Search
    // ========================================
    let currentSortColumn = 'fecha';
    let currentSortAscending = true;
    let currentPage = 1;
    const itemsPerPage = 10;
    let filteredBandejaData = [];

    // Toggle Sidebar using Bandeja menu button
    if (btnBandejaMenu) {
        btnBandejaMenu.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }



    // Date Auto-Formatting Input Handler
    const formatBandejaDateInput = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 8) {
            val = val.substring(0, 8);
        }
        if (val.length > 4) {
            val = val.substring(0, 2) + '/' + val.substring(2, 4) + '/' + val.substring(4);
        } else if (val.length > 2) {
            val = val.substring(0, 2) + '/' + val.substring(2);
        }
        e.target.value = val;
    };

    if (searchFechaDesde) {
        searchFechaDesde.addEventListener('input', formatBandejaDateInput);
    }
    if (searchFechaHasta) {
        searchFechaHasta.addEventListener('input', formatBandejaDateInput);
    }

    function getSolicitudDocumentoParts(documento) {
        const parts = String(documento || '').split(' - ');
        return {
            tipoDoc: (parts[0] || '').trim(),
            numeroDocumento: (parts[1] || '').trim()
        };
    }

    function getEstadoLabel(estado) {
        const estadoNormalizado = String(estado || '').trim().toUpperCase();
        return estadoNormalizado === 'EN PROCESO' ? 'En proceso' : estadoNormalizado;
    }

    function getEstadoClass(estado) {
        return String(estado || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
    }

    function renderBandejaNewTable(data) {
        if (!tablaBandejaNewBody) return;

        tablaBandejaNewBody.innerHTML = '';

        if (data.length === 0) {
            tablaBandejaNewBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <span class="material-icons-outlined" style="font-size: 48px; display: block; margin-bottom: 8px;">inbox</span>
                        No se encontraron solicitudes
                    </td>
                </tr>
            `;
            document.getElementById('bandejaSubResults').textContent = '0 resultados';
            document.getElementById('bandejaTotalCount').textContent = '0';
            
            // Update pagination text
            document.getElementById('currentPageNum').textContent = '1';
            document.getElementById('totalPagesNum').textContent = '1';
            document.getElementById('paginationPrevBtn').disabled = true;
            document.getElementById('paginationNextBtn').disabled = true;
            return;
        }

        // Apply sorting if a column is selected
        if (currentSortColumn) {
            data.sort((a, b) => {
                let valA = a[currentSortColumn] || '';
                let valB = b[currentSortColumn] || '';

                if (currentSortColumn === 'numeroDocumento') {
                    valA = getSolicitudDocumentoParts(a.documento)[currentSortColumn] || '';
                    valB = getSolicitudDocumentoParts(b.documento)[currentSortColumn] || '';
                }

                if (currentSortColumn === 'fecha') {
                    const parseDate = (dStr) => {
                        const parts = dStr.split(' ');
                        const dateParts = parts[0].split('-');
                        const timeParts = parts[1] ? parts[1].split(':') : ['00', '00', '00'];
                        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]);
                    };
                    valA = parseDate(valA);
                    valB = parseDate(valB);
                }

                if (valA < valB) return currentSortAscending ? -1 : 1;
                if (valA > valB) return currentSortAscending ? 1 : -1;
                return 0;
            });
        }

        // Pagination calculations
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = data.slice(startIndex, endIndex);

        pageData.forEach(sol => {
            const row = document.createElement('tr');
            const documentoParts = getSolicitudDocumentoParts(sol.documento);
            row.innerHTML = `
                <td><strong style="color: var(--primary-blue); font-weight: 700;">${sol.id}</strong></td>
                <td>${documentoParts.numeroDocumento}</td>
                <td>${sol.cliente}</td>
                <td>${sol.tienda}</td>
                <td>${sol.fecha}</td>
                <td><span style="font-weight: 700; color: #475569; font-size: 0.78rem;">${sol.etapa}</span></td>
                <td><span class="status-badge ${getEstadoClass(sol.estado)}">${getEstadoLabel(sol.estado)}</span></td>
                <td>
                    <button type="button" class="revisar-link" data-id="${sol.id}" style="background: none; border: none; padding: 0; color: var(--accent-blue); font-weight: 600; cursor: pointer; font-size: 0.82rem;">Revisar</button>
                </td>
            `;
            tablaBandejaNewBody.appendChild(row);
        });

        // Update results counts
        document.getElementById('bandejaSubResults').textContent = `${data.length} resultados`;
        document.getElementById('bandejaTotalCount').textContent = `${data.length}`;

        // Update pagination text & buttons
        document.getElementById('currentPageNum').textContent = currentPage;
        document.getElementById('totalPagesNum').textContent = totalPages;
        document.getElementById('paginationPrevBtn').disabled = (currentPage === 1);
        document.getElementById('paginationNextBtn').disabled = (currentPage === totalPages);

        // Bind click on "Revisar" link
        tablaBandejaNewBody.querySelectorAll('.revisar-link').forEach(link => {
            link.addEventListener('click', () => {
                const id = link.dataset.id;
                const solicitud = solicitudes.find(s => s.id === id);
                if (solicitud) {
                    handleRevisarAction(solicitud);
                }
            });
        });
    }

    // Pagination Click Listeners
    const paginationPrevBtn = document.getElementById('paginationPrevBtn');
    const paginationNextBtn = document.getElementById('paginationNextBtn');

    if (paginationPrevBtn) {
        paginationPrevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderBandejaNewTable(filteredBandejaData);
            }
        });
    }

    if (paginationNextBtn) {
        paginationNextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredBandejaData.length / itemsPerPage) || 1;
            if (currentPage < totalPages) {
                currentPage++;
                renderBandejaNewTable(filteredBandejaData);
            }
        });
    }

    // Set sorting columns click handler
    const sortHeaders = document.querySelectorAll('.table-bandeja-new th.sortable');
    sortHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (currentSortColumn === col) {
                currentSortAscending = !currentSortAscending;
            } else {
                currentSortColumn = col;
                currentSortAscending = true;
            }
            
            applyBandejaFilters();

            // Update sorting indicators
            sortHeaders.forEach(header => {
                const icon = header.querySelector('.sort-icon-bandeja');
                if (header === th) {
                    icon.innerHTML = currentSortAscending ? '⁝ ▲' : '⁝ ▼';
                    icon.style.color = 'var(--accent-blue)';
                } else {
                    icon.innerHTML = '⁝';
                    icon.style.color = 'var(--text-muted)';
                }
            });
        });
    });

    const parseInputDate = (str) => {
        if (!str) return null;
        const cleanStr = str.replace(/\//g, '-');
        const parts = cleanStr.split('-');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day, 0, 0, 0);
            }
        }
        return null;
    };

    const parseRecordDate = (str) => {
        if (!str) return null;
        const cleanStr = str.replace(/\//g, '-');
        const parts = cleanStr.split(' ');
        const dateParts = parts[0].split('-');
        if (dateParts.length === 3) {
            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1;
            const year = parseInt(dateParts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day, 0, 0, 0);
            }
        }
        return null;
    };

    function applyBandejaFilters() {
        const solId = document.getElementById('searchSolId').value.toLowerCase().trim();
        const docNum = document.getElementById('searchDocNum').value.toLowerCase().trim();
        const nombresVal = document.getElementById('searchNombres').value.toLowerCase().trim();
        const sucursalVal = document.getElementById('searchSucursal').value;
        const etapaVal = document.getElementById('searchEtapa')?.value || '';
        const estadoVal = document.getElementById('searchEstado').value;
        const fechaDesdeVal = document.getElementById('searchFechaDesde').value.trim();
        const fechaHastaVal = document.getElementById('searchFechaHasta').value.trim();

        let filtered = [...solicitudes];



        // Search filters
        if (solId) {
            filtered = filtered.filter(sol => sol.id.toLowerCase().includes(solId));
        }
        if (docNum) {
            filtered = filtered.filter(sol => getSolicitudDocumentoParts(sol.documento).numeroDocumento.toLowerCase().includes(docNum));
        }
        if (nombresVal) {
            filtered = filtered.filter(sol => String(sol.cliente || '').toLowerCase().includes(nombresVal));
        }
        if (sucursalVal) {
            filtered = filtered.filter(sol => sol.tienda === sucursalVal);
        }
        if (etapaVal) {
            filtered = filtered.filter(sol => sol.etapa === etapaVal);
        }
        if (estadoVal) {
            filtered = filtered.filter(sol => sol.estado === estadoVal);
        }

        // Date Range Filters
        const dateDesde = parseInputDate(fechaDesdeVal);
        const dateHasta = parseInputDate(fechaHastaVal);

        if (dateDesde) {
            filtered = filtered.filter(sol => {
                const recDate = parseRecordDate(sol.fecha);
                return recDate && recDate >= dateDesde;
            });
        }
        if (dateHasta) {
            filtered = filtered.filter(sol => {
                const recDate = parseRecordDate(sol.fecha);
                return recDate && recDate <= dateHasta;
            });
        }

        filteredBandejaData = filtered;
        renderBandejaNewTable(filteredBandejaData);
    }

    // Filtros automáticos: se ejecutan al ingresar datos o seleccionar desplegables
    [searchSolId, searchDocNum, searchNombres, searchFechaDesde, searchFechaHasta].forEach(input => {
        if (!input) return;
        input.addEventListener('input', () => {
            currentPage = 1;
            applyBandejaFilters();
        });
    });

    [searchSucursal, searchEtapa, searchEstado].forEach(select => {
        if (!select) return;
        select.addEventListener('change', () => {
            currentPage = 1;
            applyBandejaFilters();
        });
    });

    if (btnLimpiarBandeja) {
        btnLimpiarBandeja.addEventListener('click', () => {
            document.getElementById('searchSolId').value = '';
            document.getElementById('searchDocNum').value = '';
            document.getElementById('searchNombres').value = '';
            document.getElementById('searchSucursal').value = '';
            document.getElementById('searchEtapa').value = '';
            document.getElementById('searchEstado').value = '';
            document.getElementById('searchFechaDesde').value = '';
            document.getElementById('searchFechaHasta').value = '';
            
            currentPage = 1; // Reset to page 1
            applyBandejaFilters();
            showToast('Filtros de búsqueda limpiados.', 'info');
        });
    }



    // ============================
    // INGRESOS - Registro de Solicitud
    // ============================
    function parseCurrencyValue(value) {
        if (!value) return 0;
        const cleaned = String(value)
            .replace(/S\//g, '')
            .replace(/\$/g, '')
            .replace(/,/g, '')
            .replace(/\s/g, '')
            .replace(/[^0-9.-]/g, '');
        const amount = parseFloat(cleaned);
        return Number.isFinite(amount) ? amount : 0;
    }

    function formatSoles(amount) {
        return `S/ ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function setupSolicitudSolesInput(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        input.addEventListener('input', (event) => {
            event.target.value = event.target.value
                .replace(/[^0-9.]/g, '')
                .replace(/(\..*)\./g, '$1');
        });

        input.addEventListener('blur', (event) => {
            event.target.value = formatSoles(parseCurrencyValue(event.target.value));
        });
    }

    setupSolicitudSolesInput('regGastosRegistrales');
    setupSolicitudSolesInput('regGastosDelivery');

    const MAX_INGRESOS_POR_PERSONA = 2;

    const INGRESOS_CONFIG = {
        titular: {
            listSelector: '#ingresosList',
            totalId: 'totalIngresosTitular',
            addButtonId: 'btnAgregarIngreso'
        },
        conyuge: {
            listSelector: '#ingresosConyugeList',
            totalId: 'totalIngresosConyuge',
            addButtonId: 'btnAgregarIngresoConyuge'
        }
    };

    function getIngresosConfig(tipo = 'titular') {
        return INGRESOS_CONFIG[tipo] || INGRESOS_CONFIG.titular;
    }

    function getTotalIngresosFor(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const list = document.querySelector(config.listSelector);
        if (!list) return 0;

        return Array.from(list.querySelectorAll('.ingreso-monto'))
            .reduce((sum, input) => sum + parseCurrencyValue(input.value), 0);
    }

    function updateTotalIngresosCombinado() {
        const totalCombinadoEl = document.getElementById('totalIngresosCombinado');
        if (!totalCombinadoEl) return;

        const totalTitular = getTotalIngresosFor('titular');
        const totalConyuge = getTotalIngresosFor('conyuge');
        totalCombinadoEl.textContent = formatSoles(totalTitular + totalConyuge);
    }

    function updateTotalIngresosFor(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const totalEl = document.getElementById(config.totalId);
        const list = document.querySelector(config.listSelector);
        if (!totalEl || !list) return;

        const total = getTotalIngresosFor(tipo);
        totalEl.textContent = formatSoles(total);
        updateTotalIngresosCombinado();
    }

    function updateTotalIngresos() {
        updateTotalIngresosFor('titular');
    }

    function updateAgregarIngresoButtonState(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const btnAgregarIngreso = document.getElementById(config.addButtonId);
        const list = document.querySelector(config.listSelector);
        if (!btnAgregarIngreso || !list) return;

        const cantidadIngresos = list.querySelectorAll('.ingreso-item').length;
        const debeDeshabilitar = isSolicitudReadOnly || cantidadIngresos >= MAX_INGRESOS_POR_PERSONA;
        btnAgregarIngreso.disabled = debeDeshabilitar;
        btnAgregarIngreso.classList.toggle('is-disabled', debeDeshabilitar);
        btnAgregarIngreso.setAttribute('aria-disabled', String(debeDeshabilitar));
        btnAgregarIngreso.title = cantidadIngresos >= MAX_INGRESOS_POR_PERSONA
            ? 'Máximo 2 ingresos permitidos'
            : '';
    }

    function updateAllAgregarIngresoButtonsState() {
        updateAgregarIngresoButtonState('titular');
        updateAgregarIngresoButtonState('conyuge');
    }

    function refreshIngresoLabels(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const list = document.querySelector(config.listSelector);
        if (!list) return;

        list.querySelectorAll('.ingreso-item').forEach((item, index) => {
            item.dataset.ingresoIndex = String(index + 1);
            const badge = item.querySelector('.ingreso-badge');
            if (badge) badge.textContent = `Ingreso ${index + 1}`;
            const removeBtn = item.querySelector('.btn-remove-ingreso');
            if (removeBtn) removeBtn.style.display = index === 0 ? 'none' : 'inline-flex';
        });
        updateAgregarIngresoButtonState(tipo);
    }

    function createIngresoItem(index, tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const firstItem = document.querySelector(`${config.listSelector} .ingreso-item`);
        if (!firstItem) return null;
        const item = firstItem.cloneNode(true);
        item.dataset.ingresoIndex = String(index);
        item.querySelectorAll('select').forEach(select => {
            if (select.classList.contains('ingreso-anualizado')) {
                select.value = 'NO';
            } else {
                select.value = '';
            }
            select.disabled = isSolicitudReadOnly;
        });
        item.querySelectorAll('input').forEach(input => {
            input.value = input.classList.contains('ingreso-monto') ? 'S/ 0.00' : '';
            input.disabled = isSolicitudReadOnly;
        });
        const header = item.querySelector('.ingreso-item-header');
        let removeBtn = item.querySelector('.btn-remove-ingreso');
        if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'btn btn-outline btn-remove-ingreso';
            removeBtn.innerHTML = '<span class="material-icons-outlined">delete</span> Quitar';
            header.appendChild(removeBtn);
        }
        return item;
    }

    function resetIngresosSection(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const list = document.querySelector(config.listSelector);
        if (!list) return;
        const firstItem = list.querySelector('.ingreso-item');
        if (!firstItem) return;
        list.innerHTML = '';
        list.appendChild(firstItem);
        firstItem.querySelectorAll('select').forEach(select => {
            if (select.classList.contains('ingreso-anualizado')) {
                select.value = 'NO';
            } else {
                select.value = '';
            }
            select.disabled = isSolicitudReadOnly;
        });
        firstItem.querySelectorAll('input').forEach(input => {
            input.value = input.classList.contains('ingreso-monto') ? 'S/ 0.00' : '';
            input.disabled = isSolicitudReadOnly;
        });
        let removeBtn = firstItem.querySelector('.btn-remove-ingreso');
        if (removeBtn) removeBtn.style.display = 'none';
        refreshIngresoLabels(tipo);
        updateTotalIngresosFor(tipo);
    }

    function setupIngresosList(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const btnAgregarIngreso = document.getElementById(config.addButtonId);
        const ingresosList = document.querySelector(config.listSelector);

        if (!btnAgregarIngreso || !ingresosList) return;

        updateAgregarIngresoButtonState(tipo);

        btnAgregarIngreso.addEventListener('click', () => {
            if (isSolicitudReadOnly) return;
            const currentCount = ingresosList.querySelectorAll('.ingreso-item').length;
            if (currentCount >= MAX_INGRESOS_POR_PERSONA) {
                updateAgregarIngresoButtonState(tipo);
                return;
            }
            const nextIndex = currentCount + 1;
            const newItem = createIngresoItem(nextIndex, tipo);
            if (newItem) {
                ingresosList.appendChild(newItem);
                refreshIngresoLabels(tipo);
                updateTotalIngresosFor(tipo);
            }
        });

        ingresosList.addEventListener('input', (event) => {
            if (event.target.classList.contains('ingreso-ruc')) {
                event.target.value = event.target.value.replace(/\D/g, '');
            }
            if (event.target.classList.contains('ingreso-monto')) {
                updateTotalIngresosFor(tipo);
            }
        });

        ingresosList.addEventListener('blur', (event) => {
            if (event.target.classList.contains('ingreso-monto')) {
                event.target.value = formatSoles(parseCurrencyValue(event.target.value));
                updateTotalIngresosFor(tipo);
            }
        }, true);

        ingresosList.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('.btn-remove-ingreso');
            if (!removeBtn || isSolicitudReadOnly) return;
            const item = removeBtn.closest('.ingreso-item');
            if (item && ingresosList.querySelectorAll('.ingreso-item').length > 1) {
                item.remove();
                refreshIngresoLabels(tipo);
                updateTotalIngresosFor(tipo);
            }
        });
    }

    setupIngresosList('titular');
    setupIngresosList('conyuge');


    // ============================
    // INGRESOS DESDE LA PANTALLA DE CÁLCULO
    // ============================
    const ingresosCalculoDesplegable = document.getElementById('ingresosCalculoDesplegable');
    const ingresosCalculoBody = document.getElementById('ingresosCalculoBody');
    const btnAbrirIngresosCalculo = document.getElementById('btnAbrirIngresosCalculo');
    const btnCerrarIngresosCalculo = document.getElementById('btnCerrarIngresosCalculo');
    const ingresosCardOriginal = document.getElementById('ingresosCard');
    const ingresosCardPlaceholder = document.createComment('ubicacion-original-ingresos');
    let ingresosCalculoAbierto = false;
    let ingresosCardDisplayOriginal = '';
    let ingresosCardHiddenOriginal = false;
    let ingresosConyugeDisplayOriginal = '';
    let ingresosConyugeHiddenOriginal = false;

    function getTotalIngresoDeclaradoCalculo() {
        const totalTitular = getTotalIngresosFor('titular');
        const incluyeConyuge = !!(toggleConyuge && toggleConyuge.checked);
        return totalTitular + (incluyeConyuge ? getTotalIngresosFor('conyuge') : 0);
    }

    function reflejarIngresosEnCalculo() {
        if (!calcIngresoDeclaradoInput) return;
        const total = getTotalIngresoDeclaradoCalculo();
        calcIngresoDeclaradoInput.value = total > 0 ? total.toFixed(2) : '';
        updateCalcCasoPilotoState();
        const resultadoVisible = document.getElementById('calcResultadoCard').style.display !== 'none' && document.querySelector('#calcCuotasBody tr');
        if (resultadoVisible) {
            recalcularResultadoCalculo(false);
        } else {
            actualizarCapacidadCuotaMaximaCalculo(false);
        }
    }

    function abrirIngresosDesdeCalculo() {
        if (!ingresosCalculoDesplegable || !ingresosCalculoBody || !ingresosCardOriginal || resultadoActionsLockedByStage) return;
        if (ingresosCalculoAbierto) {
            cerrarIngresosDesdeCalculo();
            return;
        }
        if (!ingresosCardOriginal.parentNode) return;

        ingresosCardDisplayOriginal = ingresosCardOriginal.style.display;
        ingresosCardHiddenOriginal = ingresosCardOriginal.hidden;
        ingresosCardOriginal.parentNode.insertBefore(ingresosCardPlaceholder, ingresosCardOriginal);
        ingresosCalculoBody.appendChild(ingresosCardOriginal);
        ingresosCardOriginal.classList.add('ingresos-card-en-calculo');
        // En Cálculo el bloque debe mostrarse siempre, aunque en Solicitud haya quedado
        // oculto por las reglas de carretera.
        ingresosCardOriginal.style.display = 'block';
        ingresosCardOriginal.hidden = false;

        const conyugeSection = document.getElementById('ingresosConyugeCard');
        if (conyugeSection) {
            ingresosConyugeDisplayOriginal = conyugeSection.style.display;
            ingresosConyugeHiddenOriginal = conyugeSection.hidden;
            const mostrarConyuge = !!(toggleConyuge && toggleConyuge.checked);
            conyugeSection.style.display = mostrarConyuge ? 'block' : 'none';
            conyugeSection.hidden = !mostrarConyuge;
        }
        updateTotalIngresosFor('titular');
        updateTotalIngresosFor('conyuge');
        updateAllAgregarIngresoButtonsState();
        reflejarIngresosEnCalculo();

        ingresosCalculoDesplegable.hidden = false;
        btnAbrirIngresosCalculo?.setAttribute('aria-expanded', 'true');
        btnAbrirIngresosCalculo?.classList.add('active');
        ingresosCalculoAbierto = true;
        ingresosCalculoDesplegable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function cerrarIngresosDesdeCalculo() {
        if (!ingresosCalculoAbierto || !ingresosCalculoDesplegable || !ingresosCardOriginal) return;
        reflejarIngresosEnCalculo();

        if (ingresosCardPlaceholder.parentNode) {
            ingresosCardPlaceholder.parentNode.insertBefore(ingresosCardOriginal, ingresosCardPlaceholder);
            ingresosCardPlaceholder.remove();
        }
        ingresosCardOriginal.classList.remove('ingresos-card-en-calculo');
        ingresosCardOriginal.style.display = ingresosCardDisplayOriginal;
        ingresosCardOriginal.hidden = ingresosCardHiddenOriginal;
        const conyugeSection = document.getElementById('ingresosConyugeCard');
        if (conyugeSection) {
            conyugeSection.style.display = ingresosConyugeDisplayOriginal;
            conyugeSection.hidden = ingresosConyugeHiddenOriginal;
        }
        ingresosCalculoDesplegable.hidden = true;
        btnAbrirIngresosCalculo?.setAttribute('aria-expanded', 'false');
        btnAbrirIngresosCalculo?.classList.remove('active');
        ingresosCalculoAbierto = false;
        actualizarVisibilidadIngresosSolicitud();
    }

    if (btnAbrirIngresosCalculo) btnAbrirIngresosCalculo.addEventListener('click', abrirIngresosDesdeCalculo);
    if (btnCerrarIngresosCalculo) btnCerrarIngresosCalculo.addEventListener('click', cerrarIngresosDesdeCalculo);
    if (ingresosCardOriginal) {
        ingresosCardOriginal.addEventListener('input', () => {
            if (ingresosCalculoAbierto) reflejarIngresosEnCalculo();
        });
        ingresosCardOriginal.addEventListener('change', () => {
            if (ingresosCalculoAbierto) reflejarIngresosEnCalculo();
        });
    }


    const REGISTRO_EDITABLE_SECTION_FIELDS = {
        vehiculo: [
            'regVehEstado', 'regVehConcesionario', 'regVehTienda', 'regVehTipoDocVendedor',
            'regVehNroDocVendedor', 'regVehVendedor', 'regVehMarca', 'regVehModelo', 'regVehAnio',
            'regVehTarjetaNombre', 'regVehTerceroTipoDoc', 'regVehTerceroNumero', 'regVehTerceroNombres',
            'regVehTerceroApePaterno', 'regVehTerceroApeMaterno'
        ],
        credito: [
            'regSimProducto', 'regSimCampana', 'regSimMoneda', 'regSimTipoCambio', 'regSimPrecioVeh',
            'regSimCuotaInicial', 'regSimTea', 'regSimPlazo', 'regSimDiaPago', 'regTotalFinanciamiento'
        ],
        gastos: [
            'regGastosNotariales', 'regGastosRegistrales', 'regGastosDelivery', 'regPlanGpx',
            'regGastosInclGpx', 'regMesesCuotasDobles', 'regIncluirPortes'
        ],
        seguros: [
            'regSegVehicular', 'regSegVehCosto', 'regSegDesgravamen', 'regSegDesgProd'
        ]
    };


    const SOLICITUD_PREVIOUS_SCREEN_FIELD_IDS = [
        // Datos provenientes de Simulación / Evaluación preliminar
        'regTipoDoc', 'regNroDoc', 'regNombres', 'regApePaterno', 'regApeMaterno',
        'regFechaNac', 'stickyRegTipoDoc', 'stickyRegNroDoc',
        'stickyRegNombres', 'stickyRegApePaterno',

        // Datos del cónyuge capturados desde Simulación
        'regConTipoDoc', 'regConNroDoc',

        // Datos heredados de Simulación
        'regVehEstado', 'regVehConcesionario', 'regVehTienda',

        // Datos provenientes de Cálculo
        'regSimProducto', 'regSimCampana', 'regSimMoneda', 'regSimTipoCambio', 'regSimPrecioVeh',
        'regSimCuotaInicial', 'regSimTea', 'regSimPlazo', 'regSimDiaPago', 'regTotalFinanciamiento',
        'regGastosNotariales', 'regGastosRegistrales', 'regGastosDelivery', 'regPlanGpx',
        'regGastosInclGpx', 'regCuotasDobles', 'regMesesCuotasDobles', 'regIncluirPortes',
        'regSegVehicular', 'regSegVehCosto', 'regSegDesgravamen', 'regSegDesgProd'
    ];

    function isSolicitudPendiente(solicitud) {
        return normalizarEtapa(solicitud?.etapa) === 'SOLICITUD'
            && normalizarEtapa(solicitud?.estado) === 'PENDIENTE';
    }

    function setSolicitudPreviousFieldLocked(field, locked) {
        if (!field) return;

        if (locked) {
            if (field.dataset.solicitudPreviousLock !== 'true') {
                field.dataset.prevDisabledSolicitudPrevious = String(field.disabled);
                field.dataset.prevReadonlySolicitudPrevious = String(field.hasAttribute('readonly'));
                field.dataset.prevDisabledClassSolicitudPrevious = String(field.classList.contains('disabled'));
                field.dataset.prevReadonlyClassSolicitudPrevious = String(field.classList.contains('is-readonly'));
                field.dataset.solicitudPreviousLock = 'true';
            }

            field.disabled = true;
            field.setAttribute('aria-disabled', 'true');
            if (field.tagName !== 'SELECT') field.setAttribute('readonly', 'readonly');
            field.classList.add('disabled', 'is-readonly');
            return;
        }

        if (field.dataset.solicitudPreviousLock !== 'true') return;

        field.disabled = field.dataset.prevDisabledSolicitudPrevious === 'true';
        if (field.dataset.prevReadonlySolicitudPrevious === 'true') {
            field.setAttribute('readonly', 'readonly');
        } else {
            field.removeAttribute('readonly');
        }
        field.classList.toggle('disabled', field.dataset.prevDisabledClassSolicitudPrevious === 'true');
        field.classList.toggle('is-readonly', field.dataset.prevReadonlyClassSolicitudPrevious === 'true');
        if (field.disabled) {
            field.setAttribute('aria-disabled', 'true');
        } else {
            field.removeAttribute('aria-disabled');
        }

        delete field.dataset.solicitudPreviousLock;
        delete field.dataset.prevDisabledSolicitudPrevious;
        delete field.dataset.prevReadonlySolicitudPrevious;
        delete field.dataset.prevDisabledClassSolicitudPrevious;
        delete field.dataset.prevReadonlyClassSolicitudPrevious;
    }

    function applySolicitudPreviousScreenFieldsLock(solicitud) {
        const shouldLock = isSolicitudPendiente(solicitud);
        SOLICITUD_PREVIOUS_SCREEN_FIELD_IDS.forEach(id => {
            setSolicitudPreviousFieldLocked(document.getElementById(id), shouldLock);
        });
        syncRegistroStickyClientFields();
    }

    function setRegistroFieldValue(id, value) {
        const field = document.getElementById(id);
        if (!field || value === undefined || value === null) return;
        if (field.tagName === 'SELECT') {
            const valueText = String(value);
            const hasOption = Array.from(field.options).some(option => option.value === valueText);
            if (!hasOption && valueText) {
                field.add(new Option(valueText, valueText));
            }
            field.value = valueText;
        } else {
            field.value = value;
        }
    }

    function getRegistroFieldValues(fieldIds) {
        return fieldIds.reduce((data, id) => {
            const field = document.getElementById(id);
            if (field) data[id] = field.value;
            return data;
        }, {});
    }

    function setRegistroFieldValues(data = {}) {
        Object.entries(data).forEach(([id, value]) => setRegistroFieldValue(id, value));
    }

    function collectIngresosData(tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const list = document.querySelector(config.listSelector);
        if (!list) return [];

        return Array.from(list.querySelectorAll('.ingreso-item')).map(item => ({
            categoria: item.querySelector('.ingreso-categoria')?.value || '',
            perfil: item.querySelector('.ingreso-perfil')?.value || '',
            situacion: item.querySelector('.ingreso-situacion')?.value || '',
            fecha: item.querySelector('.ingreso-fecha')?.value || '',
            ruc: item.querySelector('.ingreso-ruc')?.value || '',
            monto: item.querySelector('.ingreso-monto')?.value || 'S/ 0.00',
            anualizado: item.querySelector('.ingreso-anualizado')?.value || 'NO'
        }));
    }

    function setIngresoItemData(item, data = {}) {
        const setValue = (selector, value) => {
            const field = item.querySelector(selector);
            if (!field) return;
            field.value = value ?? '';
        };
        setValue('.ingreso-categoria', data.categoria || '');
        setValue('.ingreso-perfil', data.perfil || '');
        setValue('.ingreso-situacion', data.situacion || '');
        setValue('.ingreso-fecha', data.fecha || '');
        setValue('.ingreso-ruc', data.ruc || '');
        setValue('.ingreso-monto', data.monto || 'S/ 0.00');
        setValue('.ingreso-anualizado', data.anualizado || 'NO');
    }

    function applyIngresosData(ingresos = [], tipo = 'titular') {
        const config = getIngresosConfig(tipo);
        const list = document.querySelector(config.listSelector);
        if (!list) return;
        resetIngresosSection(tipo);
        const dataList = Array.isArray(ingresos) && ingresos.length
            ? ingresos.slice(0, MAX_INGRESOS_POR_PERSONA)
            : [];
        dataList.forEach((data, index) => {
            let item = list.querySelectorAll('.ingreso-item')[index];
            if (!item && index > 0) {
                item = createIngresoItem(index + 1, tipo);
                if (item) list.appendChild(item);
            }
            if (item) setIngresoItemData(item, data);
        });
        refreshIngresoLabels(tipo);
        updateTotalIngresosFor(tipo);
    }

    function collectRegistroEditableData() {
        return {
            cliente: getRegistroFieldValues(['regEstadoCivil', 'regMancomunaIngresos', 'regSeparacionBienes']),
            ingresos: collectIngresosData(),
            ingresosConyuge: collectIngresosData('conyuge'),
            vehiculo: getRegistroFieldValues(REGISTRO_EDITABLE_SECTION_FIELDS.vehiculo),
            credito: getRegistroFieldValues(REGISTRO_EDITABLE_SECTION_FIELDS.credito),
            gastos: getRegistroFieldValues(REGISTRO_EDITABLE_SECTION_FIELDS.gastos),
            seguros: getRegistroFieldValues(REGISTRO_EDITABLE_SECTION_FIELDS.seguros)
        };
    }

    function applyRegistroEditableData(solicitud) {
        const data = solicitud?.registroEditableData;
        if (!data) return;
        if (data.cliente) {
            setRegistroFieldValues(data.cliente);
            const regEstadoCivilControl = document.getElementById('regEstadoCivil');
            if (regEstadoCivilControl) regEstadoCivilControl.dispatchEvent(new Event('change'));
        } else {
            actualizarVisibilidadMancomunaIngresos();
        }
        if (Array.isArray(data.ingresos)) applyIngresosData(data.ingresos);
        if (Array.isArray(data.ingresosConyuge)) applyIngresosData(data.ingresosConyuge, 'conyuge');
        setRegistroFieldValues(data.vehiculo || {});
        actualizarDatosTerceroPropiedad(false);
        setRegistroFieldValues(data.credito || {});
        setRegistroFieldValues(data.gastos || {});
        actualizarVisibilidadMesesCuotasDoblesSolicitud();
        setRegistroFieldValues(data.seguros || {});
        updateTipoSeguroDesgravamenSolicitudVisibility();
        actualizarVisibilidadIngresosSolicitud();
        updateTotalIngresosFor('titular');
        updateTotalIngresosFor('conyuge');
        updateAllAgregarIngresoButtonsState();
    }

    function enableObservedEditableControls(solicitud) {
        if (!isRiesgosObservadoEditableSolicitud(solicitud)) return;
        document.querySelectorAll('#ingresosCard input, #ingresosCard select, #ingresosConyugeCard input, #ingresosConyugeCard select').forEach(control => {
            control.disabled = false;
        });
        Object.values(REGISTRO_EDITABLE_SECTION_FIELDS).flat().forEach(id => {
            const control = document.getElementById(id);
            if (!control) return;
            control.disabled = false;
            control.readOnly = false;
            control.removeAttribute('readonly');
            control.classList.remove('disabled');
        });
        ['chkManualDni', 'chkManualRecibo', 'chkManualCotizacion'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.disabled = false;
        });
        const tarjetaNombre = document.getElementById('regVehTarjetaNombre');
        if (tarjetaNombre && tarjetaNombre.value !== 'TERCERO') {
            terceroPropiedadFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.disabled = true;
            });
        }
        lockEstadoVehiculoNuevo();
        updateAllAgregarIngresoButtonsState();
        const btnPasarRiesgos = document.getElementById('btnPasarRiesgos');
        if (btnPasarRiesgos) {
            btnPasarRiesgos.style.display = 'inline-flex';
            btnPasarRiesgos.textContent = 'Reenviar a Riesgos';
        }
    }

    // ============================
    // REGISTRATION FORM READ-ONLY & STATE PERSISTENCE
    // ============================
    function saveCurrentRegistrationState() {
        if (currentSolicitudId && document.getElementById('moduloRegistroSolicitud').classList.contains('active')) {
            const currentSol = solicitudes.find(s => s.id === currentSolicitudId);
            if (currentSol) {
                currentSol.documentos = [...attachedDocs];
                if (!isSolicitudReadOnly) {
                    const comentarioEditable = document.getElementById('regComentarios')?.value || '';
                    if (isRiesgosObservadoEditableSolicitud(currentSol)) {
                        currentSol.respuestaRiesgosBorrador = comentarioEditable;
                    } else {
                        currentSol.comentarios = comentarioEditable;
                        currentSol.comentariosBorrador = comentarioEditable;
                    }
                }
                currentSol.chkManualDni = document.getElementById('chkManualDni')?.checked || false;
                currentSol.chkManualRecibo = document.getElementById('chkManualRecibo')?.checked || false;
                currentSol.chkManualCotizacion = document.getElementById('chkManualCotizacion')?.checked || false;
                currentSol.registroEditableData = collectRegistroEditableData();
                currentSol.cartera = normalizarCarretera(document.getElementById('regCartera')?.textContent || currentSol.cartera || 'EXPRESS');
                const celular = document.getElementById('regCelular').value.trim();
                if (celular) currentSol.telefono = celular;
                currentSol.concesionario = document.getElementById('regVehConcesionario')?.value || currentSol.concesionario;
                currentSol.tienda = document.getElementById('regVehTienda')?.value || currentSol.tienda;
                currentSol.vendedorTipoDoc = document.getElementById('regVehTipoDocVendedor')?.value || currentSol.vendedorTipoDoc;
                currentSol.vendedorNroDoc = document.getElementById('regVehNroDocVendedor')?.value || currentSol.vendedorNroDoc;
                currentSol.vendedor = document.getElementById('regVehVendedor')?.value || currentSol.vendedor;
                currentSol.tipoCambio = document.getElementById('regSimTipoCambio')?.value || currentSol.tipoCambio;

                const regConyugeCard = document.getElementById('regConyugeCard');
                const conyugeVisible = !!(regConyugeCard && regConyugeCard.style.display !== 'none');
                if (conyugeVisible) {
                    currentSol.conyuge = {
                        tipoDoc: document.getElementById('regConTipoDoc')?.value || 'DNI',
                        nroDoc: document.getElementById('regConNroDoc')?.value || '',
                        apellidoPaterno: document.getElementById('regConApePaterno')?.value || '',
                        apellidoMaterno: document.getElementById('regConApeMaterno')?.value || '',
                        fechaNacimiento: document.getElementById('regConFechaNac')?.value || '',
                        nacionalidad: document.getElementById('regConNacionalidad')?.value || ''
                    };
                } else {
                    currentSol.conyuge = null;
                }
            }
        }
    }

    function applyRegistrationFormReadOnlyState(readOnly) {
        isSolicitudReadOnly = readOnly;

        // Hide/show Pasar a riesgos button
        const btnPasarRiesgos = document.getElementById('btnPasarRiesgos');
        if (btnPasarRiesgos) {
            btnPasarRiesgos.style.display = readOnly ? 'none' : 'inline-flex';
            btnPasarRiesgos.textContent = 'Pasar a Riesgos';
        }

        // Lock checkboxes
        ['chkManualDni', 'chkManualRecibo', 'chkManualCotizacion'].forEach(id => {
            const checkbox = document.getElementById(id);
            if (checkbox) checkbox.disabled = readOnly;
        });
        if (readOnly) {
            getRequiredManualChecks(document.getElementById('regCartera')?.textContent || currentCarretera).forEach(item => {
                const checkbox = document.getElementById(item.id);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Disable comments
        const regComentarios = document.getElementById('regComentarios');
        if (regComentarios) {
            regComentarios.disabled = readOnly;
        }

        // Disable/enable all inputs/selects in the module page
        const inputsAndSelects = document.querySelectorAll('#moduloRegistroSolicitud input, #moduloRegistroSolicitud select, #moduloRegistroSolicitud textarea');
        inputsAndSelects.forEach(input => {
            if (input.id !== 'inputHiddenFile' && input.id !== 'regRespuestaRiesgosComentario' && input.id !== 'regRespuestaOperacionesComentario') {
                const isOriginallyReadonly = input.classList.contains('disabled') || input.hasAttribute('readonly');
                if (readOnly) {
                    input.disabled = true;
                } else {
                    if (!isOriginallyReadonly) {
                        input.disabled = false;
                    }
                }
            }
        });
        actualizarDatosTerceroPropiedad(false);
        lockEstadoVehiculoNuevo();
        updateAllAgregarIngresoButtonsState();
    }

    // ============================
    // REVISAR ACTION ROUTER (IN-PROGRESS & READ-ONLY FLOWS)
    // ============================
    function handleRevisarAction(solicitud) {
        stageNavigationEnabledForCurrentFlow = isResultadoNavigationAllowedForSolicitud(solicitud);
        currentSolicitudId = solicitud.id; // Set active request ID

        if (solicitud.etapa === 'SIMULACIÓN') {
            // Populate and show Resultado de calificación view
            const parts = (solicitud.documento || '').split(' - ');
            const tipoDoc = parts[0] || 'DNI';
            const nroDoc = parts[1] || '';

            // Generate mock financial data based on document
            const mockData = generateMockEvaluacion(nroDoc);

            document.getElementById('resSolicitudId').textContent = solicitud.id;
            document.getElementById('resFechaHora').textContent = solicitud.fecha;
            setResultadoDocumento(tipoDoc, nroDoc);
            document.getElementById('resMontoPreaprobado').textContent = `S/ ${mockData.montoPreaprobado}`;
            document.getElementById('resCalificacion').textContent = mockData.califica ? 'CALIFICA' : 'NO CALIFICA';
            document.getElementById('resCalificacionMsg').textContent = mockData.califica
                ? 'El cliente cumple con los criterios de evaluación.'
                : 'El cliente no cumple con los criterios de evaluación.';
            document.getElementById('resSegmentoRiesgo').textContent = mockData.segmentoRiesgo;
            document.getElementById('resIngresoEstimado').textContent = `S/ ${mockData.ingresoEstimado}`;
            syncIngresoEstimadoCalculo();
            document.getElementById('resCuotaMaxima').textContent = `S/ ${mockData.capacidadCuotaMaxima}`;
            const calcCuotaMaximaReset = document.getElementById('calcCuotaMaxima');
            if (calcCuotaMaximaReset) calcCuotaMaximaReset.value = `S/ ${mockData.capacidadCuotaMaxima}`;
            if (solicitud.precioVehiculoUsd && simPrecioVehiculoUsd) {
                simPrecioVehiculoUsd.value = formatearDecimalConMiles(solicitud.precioVehiculoUsd);
                syncPrecioVehiculoSimulacionCalculo();
            }
            const calcIngresoDeclaradoReset = document.getElementById('calcIngresoDeclarado');
            if (calcIngresoDeclaradoReset) calcIngresoDeclaradoReset.value = '';
            if (typeof updateCalcCasoPilotoState === 'function') updateCalcCasoPilotoState();

            const calificacionCard = document.querySelector('.resultado-calificacion');
            const calificacionIcon = calificacionCard.querySelector('.resultado-calificacion-icon .material-icons-outlined');
            if (mockData.califica) {
                calificacionCard.classList.add('califica');
                calificacionCard.classList.remove('no-califica');
                calificacionIcon.textContent = 'check_circle';
            } else {
                calificacionCard.classList.remove('califica');
                calificacionCard.classList.add('no-califica');
                calificacionIcon.textContent = 'cancel';
            }

            // Navigate to resultado screen
            document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
            document.getElementById('moduloResultado').classList.add('active');
            applyResultadoReadOnlyState(false);
            renderStageNavigation('resultadoStageTabs', solicitud.etapa || 'SIMULACIÓN', solicitud.estado || 'PENDIENTE');
            showFlujoTab('resultado');

            // Deactivate active nav highlights
            navItems.forEach(n => n.classList.remove('active'));

            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast(`Continuando Simulación para ${solicitud.id}`, 'info');

        } else if (['FIRMA', 'FIRMAS', 'ACTIVACION'].includes(normalizarEtapa(solicitud.etapa))
            && !solicitud.operacionesDesdeDocumentariaSolicitud) {
            showBandejaDocumentaria(solicitud);

        } else if (['SOLICITUD', 'RIESGOS', 'DOCUMENTARIA', 'OPERACIONES'].includes(normalizarEtapa(solicitud.etapa)) || solicitud.operacionesDesdeDocumentariaSolicitud) {
            ensureRiesgosChecklist1Inicial(solicitud);
            const etapaNormalizada = normalizarEtapa(solicitud.etapa);
            const isReadOnly = etapaNormalizada === 'DOCUMENTARIA'
                || etapaNormalizada === 'OPERACIONES'
                || solicitud.operacionesDesdeDocumentariaSolicitud === true
                || (etapaNormalizada === 'RIESGOS' && !isRiesgosObservadoEditableSolicitud(solicitud));

            // Set read-only state for registration page elements
            applyRegistrationFormReadOnlyState(isReadOnly);

            // Populate and show Registro de solicitud view
            const parts = (solicitud.documento || '').split(' - ');
            const tipoDoc = parts[0] || 'DNI';
            const nroDoc = parts[1] || '';

            // Set top header info bar
            const carreteraSolicitud = String(solicitud.cartera || 'EXPRESS').trim().toUpperCase();
            if (normalizarEtapa(solicitud.etapa) === 'SOLICITUD') {
                solicitud.estado = 'PENDIENTE';
            }
            document.getElementById('regSolicitudId').textContent = solicitud.id;
            const regCarteraEl = document.getElementById('regCartera');
            if (regCarteraEl) {
                regCarteraEl.textContent = carreteraSolicitud;
                aplicarEstiloCarretera(regCarteraEl, carreteraSolicitud);
            }
            document.getElementById('regFechaSimulacion').textContent = solicitud.fecha || '-';
            document.getElementById('regUsuario').textContent = "ALOCHA";
            actualizarEstadoRegistroResumen(solicitud);

            // Set pre-populated fields for Datos Cliente
            document.getElementById('regTipoDoc').value = tipoDoc;
            document.getElementById('regNroDoc').value = nroDoc;
            document.getElementById('regNombres').value = "Juan";
            document.getElementById('regApePaterno').value = "Pérez";
            document.getElementById('regApeMaterno').value = "García";
            document.getElementById('regFechaNac').value = "11/05/1995";
            document.getElementById('regCelular').value = solicitud.telefono || '';
            document.getElementById('regCorreo').value = "";
            
            // Reset/populate fields
            document.getElementById('regSexo').value = "";
            document.getElementById('regNacionalidad').value = "";
            document.getElementById('regResidencia').value = "";
            document.getElementById('regDireccion').value = "";
            document.getElementById('regDepartamento').value = "";
            document.getElementById('regProvincia').innerHTML = '<option value="" disabled selected>Seleccionar</option>';
            document.getElementById('regDistrito').innerHTML = '<option value="" disabled selected>Seleccionar</option>';
            document.getElementById('regEstadoCivil').value = "";
            const regMancomunaIngresosReset = document.getElementById('regMancomunaIngresos');
            if (regMancomunaIngresosReset) regMancomunaIngresosReset.value = "";
            actualizarVisibilidadMancomunaIngresos();
            actualizarVisibilidadSeparacionBienes();
            aplicarConyugeSolicitud(solicitud.conyuge);

            // Reset Laborales
            document.getElementById('regCatLaboral').value = "";
            document.getElementById('regRucEmpleador').value = "";
            document.getElementById('regNombreCentroLaboral').value = "";
            document.getElementById('regDireccionLaboral').value = "";
            document.getElementById('regGiroActividad').value = "";
            document.getElementById('regCargo').value = "";
            document.getElementById('regFechaIngresoLab').value = "";
            document.getElementById('regMonedaIngreso').value = "PEN";
            document.getElementById('regIngresoNeto').value = "S/ 0.00";
            resetIngresosSection();
            resetIngresosSection('conyuge');
            actualizarVisibilidadIngresosSolicitud(carreteraSolicitud);

            // Pre-populate Vehiculo using Concesionario/Tienda from the solicitation
            document.getElementById('regVehEstado').value = "Nuevo";
            aplicarUbicacionSolicitud(solicitud.concesionario, solicitud.tienda);
            document.getElementById('regVehTipoDocVendedor').value = solicitud.vendedorTipoDoc || "DNI";
            document.getElementById('regVehNroDocVendedor').value = solicitud.vendedorNroDoc || "";
            document.getElementById('regVehVendedor').value = solicitud.vendedor || "ALOCHA";
            document.getElementById('regVehMarca').value = "Toyota";
            document.getElementById('regVehModelo').value = "Corolla";
            document.getElementById('regVehAnio').value = "2026";
            document.getElementById('regVehTarjetaNombre').value = "TITULAR";
        actualizarDatosTerceroPropiedad(true);

            // Pre-populate Simulación
            setRegistroFieldValue('regSimProducto', "Credito Vehicular");
            setRegistroFieldValue('regSimCampana', "SUV Mayo 2026");
            setRegistroFieldValue('regSimMoneda', "Soles (S/.)");
            setRegistroFieldValue('regSimTipoCambio', solicitud.tipoCambio || getTipoCambioCalculoValue());
            setRegistroFieldValue('regSimPrecioVeh', solicitud.precioVehiculo || (solicitud.monto || '$ 28,000.00').replace('S/', '$'));
            setRegistroFieldValue('regSimCuotaInicial', solicitud.cuotaInicial || "$ 8,000.00");
            setRegistroFieldValue('regSimTea', "12.80%");
            setRegistroFieldValue('regSimPlazo', solicitud.plazoSeleccionado || "24 meses");
            setRegistroFieldValue('regSimDiaPago', solicitud.diaPago || "03");

            // Pre-populate Gastos
            setRegistroFieldValue('regGastosNotariales', solicitud.gastosNotariales || "SI");
            setRegistroFieldValue('regGastosRegistrales', solicitud.gastosRegistrales || "SI");
            setRegistroFieldValue('regGastosDelivery', solicitud.gastosDelivery || "SI");
            setRegistroFieldValue('regPlanGpx', solicitud.planGps || "Premium");
            setRegistroFieldValue('regGastosInclGpx', solicitud.gastosInclGps || "$ 650.00");
            setRegistroFieldValue('regCuotasDobles', solicitud.cuotasDobles || "No");
            setRegistroFieldValue('regMesesCuotasDobles', solicitud.mesesCuotasDobles || (normalizeSiNoForSolicitud(solicitud.cuotasDobles || 'No') === 'Si' ? 'Agosto / Enero' : ''));
            actualizarVisibilidadMesesCuotasDoblesSolicitud();
            setRegistroFieldValue('regIncluirPortes', solicitud.incluirPortes || "No");
            setRegistroFieldValue('regTotalFinanciamiento', solicitud.totalFinanciamiento || 'S/ 21,480.00');

            // Pre-populate Seguros
            aplicarSegurosSolicitudDesdeCalculo(solicitud);

            applyRegistroEditableData(solicitud);
            enableObservedEditableControls(solicitud);

            // Load Checklist state
            attachedDocs = solicitud.documentos ? [...solicitud.documentos] : [];
            const regComentariosEl = document.getElementById('regComentarios');
            if (regComentariosEl) {
                if (isReadOnly) {
                    regComentariosEl.value = '';
                } else if (isRiesgosObservadoEditableSolicitud(solicitud)) {
                    regComentariosEl.value = solicitud.respuestaRiesgosBorrador || '';
                    regComentariosEl.placeholder = 'Ingrese el comentario de respuesta a Riesgos. Los comentarios anteriores se mantienen en el historial.';
                } else {
                    regComentariosEl.value = getComentarioEditableSolicitud(solicitud);
                    regComentariosEl.placeholder = 'Ingrese comentarios sobre los documentos adjuntos o el estado del checklist...';
                }
            }
            toggleRegistroComentariosCards(isReadOnly, solicitud);
            actualizarControlesDocumentariaSolicitud(solicitud);
            actualizarRespuestaOperacionesSolicitud(solicitud);
            lockDatosClienteYConyugeRiesgosObservado(solicitud);
            renderChecklistTable();
            actualizarChecklistPorCarretera(carreteraSolicitud);
            actualizarVisibilidadIngresosSolicitud(carreteraSolicitud);
            enableObservedEditableControls(solicitud);
            applySolicitudPreviousScreenFieldsLock(solicitud);

            // Set checkboxes checks
            if (isReadOnly) {
                getRequiredManualChecks(carreteraSolicitud).forEach(item => {
                    const checkbox = document.getElementById(item.id);
                    if (checkbox) checkbox.checked = true;
                });
            } else {
                const chkManualDni = document.getElementById('chkManualDni');
                if (chkManualDni) chkManualDni.checked = !!solicitud.chkManualDni;
                const chkManualRecibo = document.getElementById('chkManualRecibo');
                const chkManualCotizacion = document.getElementById('chkManualCotizacion');
                if (chkManualRecibo) chkManualRecibo.checked = !!solicitud.chkManualRecibo;
                if (chkManualCotizacion) chkManualCotizacion.checked = !!solicitud.chkManualCotizacion;
            }
            enableObservedEditableControls(solicitud);
            lockDatosClienteYConyugeRiesgosObservado(solicitud);

            // Navigate to Registro screen
            document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
            document.getElementById('moduloRegistroSolicitud').classList.add('active');
            syncRegistroStickyClientFields();
            setTimeout(updateRegistroStickyClientBar, 0);

            // Deactivate active nav highlights
            navItems.forEach(n => n.classList.remove('active'));

            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast(isReadOnly ? `Visualizando Registro de Solicitud (Solo Lectura) para ${solicitud.id}` : `Continuando Registro de Solicitud para ${solicitud.id}`, 'info');

        } else {
            // Fallback for other final stages
            openModal(solicitud);
        }
    }


    // ============================
    // BANDEJA DOCUMENTARIA
    // ============================
    function setDocumentariaFieldValue(id, value) {
        const field = document.getElementById(id);
        if (!field) return;
        const safeValue = value ?? '';
        if (field.tagName === 'SELECT' && safeValue && !Array.from(field.options).some(option => option.value === safeValue)) {
            const option = document.createElement('option');
            option.value = safeValue;
            option.textContent = safeValue;
            field.appendChild(option);
        }
        field.value = safeValue;
    }

    function getDocumentariaClienteBaseData(solicitud, numeroDocumento) {
        const tipoDocumento = (solicitud.documento || 'DNI - 71865987').split(' - ')[0] || 'DNI';
        const cliente = (solicitud.cliente || 'Pérez García Juan').trim();
        const partesCliente = cliente.split(/\s+/).filter(Boolean);
        const apellidoPaterno = partesCliente[0] || 'Pérez';
        const apellidoMaterno = partesCliente[1] || 'García';
        const nombres = partesCliente.slice(2).join(' ') || 'Juan';

        return {
            tipoDocumento,
            numeroDocumento,
            nombres,
            apellidoPaterno,
            apellidoMaterno,
            fechaNacimiento: '11/05/1995',
            telefono: solicitud.telefono || '922159933',
            correo: 'juan.perez@email.com',
            sexo: 'Masculino',
            nacionalidad: 'Peruana',
            residencia: 'Perú',
            direccion: 'Av. Las Palmeras 123, San Miguel',
            departamento: 'Lima',
            provincia: 'Lima',
            distrito: solicitud.tienda || 'San Miguel',
            estadoCivil: 'Casado',
            separacionBienes: 'No',
            ...(solicitud.documentariaCliente || {})
        };
    }

    function cargarDatosClienteDocumentaria(solicitud, numeroDocumento) {
        const clienteDoc = getDocumentariaClienteBaseData(solicitud, numeroDocumento);

        setDocumentariaFieldValue('docClienteTipoDoc', clienteDoc.tipoDocumento);
        setDocumentariaFieldValue('docClienteNumero', clienteDoc.numeroDocumento);
        setDocumentariaFieldValue('docClienteNombres', clienteDoc.nombres);
        setDocumentariaFieldValue('docClienteApePaterno', clienteDoc.apellidoPaterno);
        setDocumentariaFieldValue('docClienteApeMaterno', clienteDoc.apellidoMaterno);
        setDocumentariaFieldValue('docClienteFechaNacimiento', clienteDoc.fechaNacimiento);
        setDocumentariaFieldValue('docClienteTelefono', clienteDoc.telefono);
        setDocumentariaFieldValue('docClienteCorreo', clienteDoc.correo);
        setDocumentariaFieldValue('docClienteSexo', clienteDoc.sexo);
        setDocumentariaFieldValue('docClienteNacionalidad', clienteDoc.nacionalidad);
        setDocumentariaFieldValue('docClienteResidencia', clienteDoc.residencia);
        setDocumentariaFieldValue('docClienteDireccion', clienteDoc.direccion);
        setDocumentariaFieldValue('docClienteDepartamento', clienteDoc.departamento);
        setDocumentariaFieldValue('docClienteProvincia', clienteDoc.provincia);
        setDocumentariaFieldValue('docClienteDistrito', clienteDoc.distrito);
        setDocumentariaFieldValue('docClienteEstadoCivil', clienteDoc.estadoCivil);
        setDocumentariaFieldValue('docClienteSeparacionBienes', clienteDoc.separacionBienes);
    }

    function showBandejaDocumentaria(solicitud) {
        const docSolicitudId = document.getElementById('docSolicitudId');
        const docFechaSimulacion = document.getElementById('docFechaSimulacion');
        const docEtapa = document.getElementById('docEtapa');
        const docResumenNumero = document.getElementById('docResumenNumero');
        const docResumenCliente = document.getElementById('docResumenCliente');
        const numeroDocumento = (solicitud.documento || 'DNI - 71865987').split(' - ')[1] || '71865987';

        const isOperaciones = isOperacionesObservadoSolicitud(solicitud);

        if (documentariaPageTitle) documentariaPageTitle.textContent = isOperaciones ? 'Operaciones' : (isSolicitudEnFirma(solicitud) ? 'Firmas' : 'Bandeja documentaria');
        if (docSolicitudId) docSolicitudId.textContent = solicitud.id || 'EFE004';
        if (docFechaSimulacion) docFechaSimulacion.textContent = solicitud.fecha || '22-05-2026 15:30:00';
        if (docEtapa) docEtapa.textContent = normalizarEtapa(solicitud.etapa) === 'ACTIVACION' ? 'OPERACIONES' : (solicitud.etapa || 'DOCUMENTARIA');
        actualizarEstadoDocumentariaResumen(solicitud);
        if (docResumenNumero) docResumenNumero.textContent = numeroDocumento;
        if (docResumenCliente) docResumenCliente.textContent = solicitud.cliente || 'Pérez García Juan';
        cargarDatosClienteDocumentaria(solicitud, numeroDocumento);

        currentDocumentariaSolicitud = solicitud;
        if (isOperaciones && typeof solicitud.operacionesRespuestaHabilitada !== 'boolean') {
            solicitud.operacionesRespuestaHabilitada = false;
        }
        if (isOperaciones && typeof solicitud.operacionesRespuestaEnviada !== 'boolean') {
            solicitud.operacionesRespuestaEnviada = false;
        }
        isChecklist2ReadOnly = isOperaciones ? !!solicitud.operacionesRespuestaEnviada : !!solicitud.documentariaEnviadaOperaciones;
        docChecklist2Docs = Array.isArray(solicitud.checklist2Docs) ? solicitud.checklist2Docs : [];
        if (!Array.isArray(solicitud.checklist2Docs)) solicitud.checklist2Docs = docChecklist2Docs;
        actualizarEstadoFirmaChecklist2(solicitud);
        updateDocumentariaTitleAndStage();
        saveSolicitudFirmaAutomaticaState(solicitud);
        docChecklist2ComentarioValue = String(solicitud.checklist2Comentario || '').slice(0, 250);
        if (docChecklist2Comentario) {
            docChecklist2Comentario.value = docChecklist2ComentarioValue;
            updateChecklist2ComentarioState();
        }

        downloadedPostAprobacionDocs.clear();
        if (Array.isArray(solicitud.downloadedPostAprobacionDocs)) {
            solicitud.downloadedPostAprobacionDocs.forEach(docName => downloadedPostAprobacionDocs.add(docName));
        }
        contratoGarantiaGenerado = !!solicitud.contratoGarantiaGenerado || downloadedPostAprobacionDocs.has('Contrato de garantía');
        solicitud.contratoGarantiaGenerado = contratoGarantiaGenerado;
        postAprobacionCollapsed = !!solicitud.postAprobacionCollapsed;
        postAprobacionCompletionPopupShown = !!solicitud.postAprobacionCompletionPopupShown;

        setDocumentariaTab('vehiculo');
        updateContratoGarantiaDownloadState();
        syncDocumentariaDownloadFlow();

        document.querySelectorAll('.module-page').forEach(p => p.classList.remove('active'));
        const docPage = document.getElementById('moduloBandejaDocumentaria');
        if (docPage) docPage.classList.add('active');

        navItems.forEach(n => n.classList.remove('active'));
        if (document.getElementById('navBandeja')) document.getElementById('navBandeja').classList.add('active');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function setDocumentariaTab(tabName) {
        const panelMap = {
            vehiculo: 'docTabVehiculo',
            domiciliaria: 'docTabDomiciliaria',
            cliente: 'docTabCliente'
        };

        document.querySelectorAll('.documentaria-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.docTab === tabName);
        });

        document.querySelectorAll('.documentaria-tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === panelMap[tabName]);
        });
    }

    document.querySelectorAll('.documentaria-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            setDocumentariaTab(btn.dataset.docTab);
        });
    });

    let garantiaValidationAttempted = false;

    function getGarantiaRequiredFields() {
        return Array.from(document.querySelectorAll('[data-garantia-required="true"]'));
    }

    function isGarantiaFieldComplete(field) {
        return String(field.value || '').trim() !== '';
    }

    function isGarantiaCompleta() {
        const requiredFields = getGarantiaRequiredFields();
        return requiredFields.length > 0 && requiredFields.every(isGarantiaFieldComplete);
    }

    function clearGarantiaRequiredHighlight(field) {
        field.classList.remove('is-required-missing');
        field.removeAttribute('aria-invalid');
        const group = field.closest('.form-group');
        if (group) group.classList.remove('field-required-missing');
    }

    function markGarantiaFieldRequired(field) {
        field.classList.add('is-required-missing');
        field.setAttribute('aria-invalid', 'true');
        const group = field.closest('.form-group');
        if (group) group.classList.add('field-required-missing');
    }

    function updateGarantiaRequiredHighlights() {
        const missingFields = [];
        getGarantiaRequiredFields().forEach(field => {
            if (isGarantiaFieldComplete(field)) {
                clearGarantiaRequiredHighlight(field);
            } else {
                missingFields.push(field);
                if (garantiaValidationAttempted) markGarantiaFieldRequired(field);
            }
        });
        return missingFields;
    }

    function highlightMissingGarantiaFields() {
        garantiaValidationAttempted = true;
        const missingFields = updateGarantiaRequiredHighlights();
        if (!missingFields.length) return true;

        setDocumentariaTab('vehiculo');
        window.requestAnimationFrame(() => {
            const firstMissing = missingFields[0];
            firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstMissing.focus({ preventScroll: true });
        });
        return false;
    }

    function isDocumentariaPendienteContratoGarantia() {
        if (!currentDocumentariaSolicitud) return false;
        return normalizarEtapa(currentDocumentariaSolicitud.etapa) === 'DOCUMENTARIA'
            && normalizarEtapa(currentDocumentariaSolicitud.estado || 'PENDIENTE') === 'PENDIENTE';
    }

    function updateGenerarContratoGarantiaButtonState() {
        if (docGarantiaContratoActions) {
            docGarantiaContratoActions.hidden = !isDocumentariaPendienteContratoGarantia();
        }
        if (!btnGenerarContratoGarantia) return;

        const icon = btnGenerarContratoGarantia.querySelector('.material-icons-outlined');
        const label = btnGenerarContratoGarantia.querySelector('span:last-child');
        btnGenerarContratoGarantia.disabled = contratoGarantiaGenerado;
        btnGenerarContratoGarantia.classList.toggle('is-generated', contratoGarantiaGenerado);
        btnGenerarContratoGarantia.title = contratoGarantiaGenerado
            ? 'Contrato de garantía generado y desbloqueado.'
            : 'Generar y desbloquear el contrato de garantía.';

        if (icon) icon.textContent = contratoGarantiaGenerado ? 'check_circle' : 'article';
        if (label) label.textContent = contratoGarantiaGenerado ? 'Contrato generado' : 'Generar contrato';
    }

    function updateContratoGarantiaDownloadState() {
        const btnContratoGarantia = document.getElementById('btnDescargarContratoGarantia');
        if (!btnContratoGarantia) return;

        const habilitarDescarga = contratoGarantiaGenerado;
        btnContratoGarantia.disabled = !habilitarDescarga;
        btnContratoGarantia.classList.toggle('is-disabled', !habilitarDescarga);
        btnContratoGarantia.setAttribute('aria-disabled', String(!habilitarDescarga));
        btnContratoGarantia.title = habilitarDescarga
            ? 'Descargar Contrato de garantía'
            : 'Genere el contrato desde el cuadro GARANTÍA para habilitar la descarga';

        const icon = btnContratoGarantia.querySelector('.material-icons-outlined');
        if (icon) icon.textContent = habilitarDescarga ? 'download' : 'lock';

        const docIcon = document.querySelector('[data-doc-icon="contrato-garantia"]');
        if (docIcon) {
            docIcon.classList.toggle('warning', !habilitarDescarga);
            docIcon.setAttribute('aria-label', habilitarDescarga ? 'Documento generado' : 'Documento pendiente');
        }

        updateGenerarContratoGarantiaButtonState();
    }

    function getDownloadablePostAprobacionDocs() {
        return Array.from(document.querySelectorAll('.documentaria-documents .doc-download-btn'))
            .filter(btn => !btn.disabled)
            .map(btn => btn.dataset.docName)
            .filter(Boolean);
    }

    function descargarDocumentoPostAprobacion(docName) {
        if (!docName) return;
        console.log(`Descarga solicitada: ${docName}`);
    }

    getGarantiaRequiredFields().forEach(field => {
        const actualizarFlujoDocumentario = () => {
            if (contratoGarantiaGenerado) {
                contratoGarantiaGenerado = false;
                if (currentDocumentariaSolicitud) currentDocumentariaSolicitud.contratoGarantiaGenerado = false;
                downloadedPostAprobacionDocs.delete('Contrato de garantía');
            }
            updateGarantiaRequiredHighlights();
            updateContratoGarantiaDownloadState();
            syncDocumentariaDownloadFlow();
        };
        field.addEventListener('input', actualizarFlujoDocumentario);
        field.addEventListener('change', actualizarFlujoDocumentario);
    });

    if (btnGenerarContratoGarantia) {
        btnGenerarContratoGarantia.addEventListener('click', () => {
            if (contratoGarantiaGenerado) return;
            if (!isGarantiaCompleta()) {
                highlightMissingGarantiaFields();
                showToast('Complete los datos obligatorios de GARANTÍA para generar el contrato.', 'warning');
                return;
            }

            contratoGarantiaGenerado = true;
            if (currentDocumentariaSolicitud) currentDocumentariaSolicitud.contratoGarantiaGenerado = true;
            updateContratoGarantiaDownloadState();
            syncDocumentariaDownloadFlow();
            showToast('Contrato de garantía generado y desbloqueado.', 'success');
        });
    }

    document.querySelectorAll('.documentaria-documents .doc-download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            descargarDocumentoPostAprobacion(btn.dataset.docName);
            markPostAprobacionDocDownloaded(btn.dataset.docName);
        });
    });

    const btnDescargarTodosDocs = document.getElementById('btnDescargarTodosDocs');
    if (btnDescargarTodosDocs) {
        btnDescargarTodosDocs.addEventListener('click', () => {
            if (!isGarantiaCompleta()) {
                highlightMissingGarantiaFields();
                return;
            }
            if (!contratoGarantiaGenerado) {
                setDocumentariaTab('vehiculo');
                if (btnGenerarContratoGarantia && docGarantiaContratoActions && !docGarantiaContratoActions.hidden) {
                    btnGenerarContratoGarantia.focus({ preventScroll: true });
                }
                showToast('Primero genere el contrato de garantía para desbloquear su descarga.', 'warning');
                return;
            }

            updateContratoGarantiaDownloadState();
            const documentos = getDownloadablePostAprobacionDocs();
            console.log('Descarga solicitada de documentos Post Aprobación:', documentos);
            documentos.forEach(docName => downloadedPostAprobacionDocs.add(docName));
            syncDocumentariaDownloadFlow();
        });
    }

    if (btnVerMasPostDocs) {
        btnVerMasPostDocs.addEventListener('click', () => {
            postAprobacionCollapsed = !postAprobacionCollapsed;
            updatePostAprobacionCollapseState();
        });
    }

    updateContratoGarantiaDownloadState();
    syncDocumentariaDownloadFlow();

    const btnVolverBandejaDocumentaria = document.getElementById('btnVolverBandejaDocumentaria');
    if (btnVolverBandejaDocumentaria) {
        btnVolverBandejaDocumentaria.addEventListener('click', () => {
            volverABandejaEntradaDesdeDocumentaria();
        });
    }

    // ============================
    // MODAL
    // ============================
    function openModal(solicitud) {
        modalTitle.textContent = `Detalle - ${solicitud.id}`;
        modalBody.innerHTML = `
            <div style="display: grid; gap: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">N° Solicitud</p>
                        <p style="font-weight: 600; color: var(--primary-blue);">${solicitud.id}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Estado</p>
                        <span class="status-badge ${getEstadoClass(solicitud.estado)}">${getEstadoLabel(solicitud.estado)}</span>
                    </div>
                </div>
                <div style="height: 1px; background: var(--border-color);"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Cliente</p>
                        <p style="font-weight: 600;">${solicitud.cliente}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Documento</p>
                        <p style="font-weight: 500;">${solicitud.documento}</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Tipo de crédito</p>
                        <p style="font-weight: 500;">${solicitud.tipoCredito}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Monto</p>
                        <p style="font-weight: 700; color: var(--primary-blue); font-size: 1.1rem;">${solicitud.monto}</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Teléfono</p>
                        <p style="font-weight: 500;">${solicitud.telefono}</p>
                    </div>
                    <div>
                        <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Concesionario</p>
                        <p style="font-weight: 500;">${solicitud.concesionario}</p>
                    </div>
                </div>
                <div>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Fecha de registro</p>
                    <p style="font-weight: 500;">${solicitud.fecha}</p>
                </div>
            </div>
        `;
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        restaurarCambioStageSimulacionPendiente();
        limpiarConfirmacionCambioStageSimulacionHandler();
        limpiarConfirmacionSimulacionCancelHandler();
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        const cancelBtn = document.getElementById('modalBtnCancel');
        const actionBtn = document.getElementById('modalBtnAction');
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-flex';
            cancelBtn.textContent = 'Cerrar';
        }
        if (actionBtn) {
            const cleanActionBtn = actionBtn.cloneNode(true);
            cleanActionBtn.style.display = 'inline-flex';
            cleanActionBtn.textContent = 'Aceptar';
            actionBtn.parentNode.replaceChild(cleanActionBtn, actionBtn);
        }
    }

    modalClose.addEventListener('click', closeModal);
    modalBtnCancel.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // ============================
    // TOAST NOTIFICATIONS
    // ============================
    function showToast(message, type = 'info') {
        // Notificaciones laterales deshabilitadas por requerimiento.
        if (toastContainer) toastContainer.innerHTML = '';
    }

    // ============================
    // CONFIG BUTTON (placeholder)
    // ============================
    const btnConfiguracion = document.getElementById('btnConfiguracion');
    if (btnConfiguracion) {
        btnConfiguracion.addEventListener('click', () => {
            showToast('Módulo de configuración - Próximamente disponible.', 'info');
        });
    }

    // ============================
    // DISCLAIMER LINK
    // ============================
    document.getElementById('disclaimerLink').addEventListener('click', () => {
        modalTitle.textContent = 'Aviso de privacidad';
        modalBody.innerHTML = `
            <p style="color: var(--text-secondary); line-height: 1.7; font-size: 0.9rem;">
                El cliente acepta que sus datos personales ingresados en este formulario serán utilizados
                exclusivamente para la <strong>simulación y evaluación preliminar de crédito vehicular</strong>
                por parte de Financiera Efectiva S.A., de conformidad con la Ley N° 29733, Ley de Protección
                de Datos Personales y su Reglamento.
            </p>
            <p style="color: var(--text-secondary); line-height: 1.7; font-size: 0.9rem; margin-top: 12px;">
                Los datos proporcionados no serán compartidos con terceros sin el consentimiento
                previo del titular, salvo las excepciones previstas por ley.
            </p>
        `;
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    resetIngresosSection();
    resetIngresosSection('conyuge');
    actualizarVisibilidadMancomunaIngresos();
    actualizarVisibilidadIngresosSolicitud();

    // ============================
    // INITIAL RENDER
    // ============================
    // Bandeja table will render when module is activated
});
