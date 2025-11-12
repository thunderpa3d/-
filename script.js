// ========== نظام قفل كلمة المرور ==========
const correctPassword = "60602025";

// دوال المساعدة العامة
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// التحقق من حالة المصادقة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, checking authentication...');
    const isAuthenticated = localStorage.getItem('appAuthenticated');
    
    if (isAuthenticated === 'true') {
        console.log('User authenticated, hiding password screen');
        hidePasswordScreen();
    } else {
        console.log('User not authenticated, showing password screen');
        showPasswordScreen();
    }
});

function checkPassword() {
    const input = document.getElementById('password-input').value;
    const errorElement = document.getElementById('error-message');
    
    if (!errorElement) {
        console.error('Error element not found');
        return;
    }
    
    console.log('Password check triggered, input:', input);
    
    if (input === correctPassword) {
        console.log('Password correct, authenticating user');
        localStorage.setItem('appAuthenticated', 'true');
        hidePasswordScreen();
        initializeAppAfterAuth();
    } else {
        console.log('Password incorrect');
        errorElement.textContent = 'كلمة المرور غير صحيحة!';
        const passwordInput = document.getElementById('password-input');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.style.animation = 'shake 0.5s';
            setTimeout(() => {
                passwordInput.style.animation = '';
            }, 500);
        }
    }
}

function hidePasswordScreen() {
    console.log('Hiding password screen');
    const passwordScreen = document.getElementById('password-screen');
    const appContainer = document.querySelector('.app-container');
    
    if (passwordScreen) passwordScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';
}

function showPasswordScreen() {
    console.log('Showing password screen');
    const passwordScreen = document.getElementById('password-screen');
    const appContainer = document.querySelector('.app-container');
    
    if (passwordScreen) passwordScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function resetPassword() {
    console.log('Resetting password authentication');
    localStorage.removeItem('appAuthenticated');
    showPasswordScreen();
    
    const passwordInput = document.getElementById('password-input');
    const errorMessage = document.getElementById('error-message');
    
    if (passwordInput) passwordInput.value = '';
    if (errorMessage) errorMessage.textContent = '';
}

// السماح باستخدام زر Enter لإدخال كلمة المرور
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password-input');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                checkPassword();
            }
        });
    }
});

// ========== تطبيق دليل الاتصال الذكي - مع إصلاح المزامنة ==========
class SmartContactApp {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.config = {
          githubUrl: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
     syncInterval: 300000, // 5 دقائق
            maxRetries: 3,
            retryDelay: 2000
        };
        
        this.isLoading = false;
        this.retryCount = 0;
        this.currentDataSourceIndex = 0;
        
        this.init();
    }

    init() {
        console.log('Initializing SmartContactApp');
        this.cacheElements();
        this.bindEvents();
        this.loadApp();
        this.startAutoSync();
    }

    cacheElements() {
        this.elements = {
            contactsContainer: document.getElementById('contactsContainer'),
            searchInput: document.getElementById('searchInput'),
            notificationCenter: document.getElementById('notificationCenter'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            manualSync: document.getElementById('manualSync'),
            contactsCount: document.getElementById('contactsCount'),
            searchClear: document.querySelector('.header-search-clear'),
            appHeader: document.querySelector('.app-header')
        };

        // التحقق من وجود العناصر الهامة
        if (!this.elements.contactsContainer) {
            console.error('Contacts container not found');
        }
    }

    bindEvents() {
        // البحث مع Debounce
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', 
                debounce(() => this.searchContacts(), 300)
            );
        }

        if (this.elements.searchClear) {
            this.elements.searchClear.addEventListener('click', () => {
                if (this.elements.searchInput) {
                    this.elements.searchInput.value = '';
                    this.searchContacts();
                    this.elements.searchInput.focus();
                }
            });
        }

        // المزامنة اليدوية
        if (this.elements.manualSync) {
            this.elements.manualSync.addEventListener('click', 
                () => this.syncWithGitHub(true)
            );
        }

        // اكتشاف حالة الاتصال
        window.addEventListener('online', () => {
            this.showNotification('متصل بالإنترنت - جاري المزامنة...', 'info');
            setTimeout(() => this.syncWithGitHub(), 1000);
        });

        window.addEventListener('offline', () => {
            this.showNotification('غير متصل بالإنترنت', 'warning');
        });

        if (this.elements.notificationCenter) {
            this.elements.notificationCenter.addEventListener('click', (e) => {
                if (e.target.closest('.notification')) {
                    e.target.closest('.notification').remove();
                }
            });
        }

        if (this.elements.contactsContainer) {
            this.elements.contactsContainer.addEventListener('click', (e) => {
                this.handleDynamicActions(e);
            });
        }
    }

    handleDynamicActions(event) {
        const target = event.target;
        
        if (target.closest('.copy-btn-small')) {
            const button = target.closest('.copy-btn-small');
            const value = button.getAttribute('data-copy-value');
            const label = button.getAttribute('data-copy-label');
            if (value) {
                this.copyToClipboard(value, label);
            }
            return;
        }
        
        if (target.closest('.action-btn-horizontal:not(.disabled)')) {
            const button = target.closest('.action-btn-horizontal');
            const type = button.getAttribute('data-action-type');
            const value = button.getAttribute('data-action-value');
            
            if (type && value) {
                this.handleAction(type, value);
            }
            return;
        }
    }

    async loadApp() {
        if (this.isLoading) return;
        
        this.showLoading();
        
        try {
            await this.loadContacts();
            this.renderContacts();
            
            if (navigator.onLine) {
                setTimeout(() => this.syncWithGitHub(), 1000);
            } else {
                this.showNotification('التطبيق يعمل في الوضع غير المتصل', 'info');
            }
        } catch (error) {
            console.error('App load error:', error);
            this.showNotification('خطأ في تحميل التطبيق', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadContacts() {
        try {
            const savedContacts = localStorage.getItem('smartContactApp');
            const timestamp = localStorage.getItem('smartContactApp_timestamp');
            
            if (savedContacts) {
                this.contacts = JSON.parse(savedContacts);
                this.filteredContacts = [...this.contacts];
                this.updateContactsCount();
                
                const age = timestamp ? Date.now() - parseInt(timestamp) : Infinity;
                if (age > this.config.cacheTimeout && navigator.onLine) {
                    this.showNotification('جاري تحديث البيانات...', 'info');
                } else if (this.contacts.length > 0) {
                    this.showNotification(`تم تحميل ${this.contacts.length} جهة اتصال من الذاكرة المحلية`, 'success');
                }
            } else {
                this.showNotification('لا توجد بيانات محلية، جاري التحميل...', 'info');
                this.loadSampleData();
            }
        } catch (error) {
            console.error('Load contacts error:', error);
            this.loadSampleData();
        }
    }

    async syncWithGitHub(force = false) {
        if (!navigator.onLine) {
            this.showNotification('غير متصل بالإنترنت', 'warning');
            return false;
        }

        if (this.isLoading && !force) {
            this.showNotification('جاري المزامنة بالفعل...', 'info');
            return false;
        }

        this.isLoading = true;
        this.showLoading();
        this.showNotification('جاري المزامنة مع مركز البيانات...', 'info');

        try {
            let success = false;
            let lastError = null;

            // تجربة جميع مصادر البيانات المتاحة
            for (let i = 0; i < this.config.dataSources.length; i++) {
                const dataSource = this.config.dataSources[this.currentDataSourceIndex];
                console.log(`Trying data source: ${dataSource.name} - ${dataSource.url}`);
                
                try {
                    success = await this.fetchAndProcessData(dataSource);
                    if (success) {
                        console.log(`✅ Success with data source: ${dataSource.name}`);
                        break;
                    }
                } catch (error) {
                    lastError = error;
                    console.error(`❌ Failed with data source ${dataSource.name}:`, error);
                    
                    // الانتقال إلى المصدر التالي
                    this.currentDataSourceIndex = (this.currentDataSourceIndex + 1) % this.config.dataSources.length;
                    
                    if (i < this.config.dataSources.length - 1) {
                        this.showNotification(`جرب مصدر بيانات بديل... (${i + 1}/${this.config.dataSources.length})`, 'warning');
                        await this.delay(1000);
                    }
                }
            }

            if (!success) {
                throw lastError || new Error('فشل جميع مصادر البيانات');
            }

            this.retryCount = 0;
            return true;

        } catch (error) {
            console.error('Sync error:', error);
            
            this.retryCount++;
            let errorMessage = 'فشل المزامنة - استخدام البيانات المحلية';
            
            if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
                errorMessage = 'مشكلة في الاتصال بالخادم - جاري استخدام البيانات المحلية';
            } else if (error.message.includes('404')) {
                errorMessage = 'ملف البيانات غير موجود على الخادم';
            } else if (error.message.includes('network')) {
                errorMessage = 'مشكلة في الاتصال بالإنترنت';
            }
            
            this.showNotification(errorMessage, 'error');
            
            if (this.retryCount <= this.config.maxRetries) {
                this.showNotification(`محاولة أخرى (${this.retryCount}/${this.config.maxRetries})`, 'warning');
                setTimeout(() => this.syncWithGitHub(), this.config.retryDelay);
            }
            return false;
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    async fetchAndProcessData(dataSource) {
        console.log(`Fetching data from: ${dataSource.url}`);

        const response = await this.fetchWithTimeout(dataSource.url, {
            timeout: 15000,
            retries: 2
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        
        if (arrayBuffer.byteLength === 0) {
            throw new Error('الملف المستلم فارغ');
        }

        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            throw new Error('ملف Excel لا يحتوي على أوراق');
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
            defval: '',
            raw: false
        });
        
        console.log('Raw Excel data:', jsonData);
        
        if (!jsonData || jsonData.length === 0) {
            throw new Error('الملف لا يحتوي على بيانات صالحة');
        }
        
        const processedData = this.processExcelData(jsonData);
        
        if (processedData.length === 0) {
            throw new Error('لا توجد جهات اتصال صالحة بعد المعالجة');
        }

        this.contacts = processedData;
        this.saveToLocalStorage();
        this.filteredContacts = [...this.contacts];
        this.renderContacts();
        
        this.showNotification(`تم تحديث ${this.contacts.length} جهة اتصال`, 'success');
        return true;
    }

    async fetchWithTimeout(url, options = {}) {
        const { timeout = 15000, retries = 2 } = options;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                    throw new Error('مهلة الاتصال انتهت');
                }, timeout);

                console.log(`Fetch attempt ${attempt} for: ${url}`);
                
                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*'
                    },
                    mode: 'cors'
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                return response;
            } catch (error) {
                console.error(`Fetch attempt ${attempt} failed:`, error);
                if (attempt === retries) throw error;
                await this.delay(this.config.retryDelay);
            }
        }
    }

    processExcelData(jsonData) {
        console.log('Processing Excel data, rows:', jsonData.length);
        
        const columnMappings = {
            name: ['الاسم', 'name', 'اسم', 'اسم الجهة', 'جهة الاتصال'],
            lastName: ['اللقب', 'lastname', 'last name', 'لقب', 'الكنية'],
            phone: ['رقم الهاتف', 'phone', 'هاتف', 'تلفون', 'جوال'],
            whatsapp: ['واتساب', 'whatsapp', 'رقم الواتساب', 'WhatsApp'],
            telegram: ['تليجرام', 'telegram', 'تيليجرام', 'حساب التليجرام'],
        };

        const contacts = jsonData
            .map((row, index) => {
                try {
                    const findValue = (keys) => {
                        for (const key of keys) {
                            const foundKey = Object.keys(row).find(k => 
                                this.normalizeText(k) === this.normalizeText(key)
                            );
                            if (foundKey && row[foundKey] !== null && row[foundKey] !== undefined && row[foundKey] !== '') {
                                const value = String(row[foundKey]).trim();
                                if (value && value !== 'undefined' && value !== 'null') {
                                    return value;
                                }
                            }
                        }
                        return '';
                    };

                    const contact = {
                        id: `contact-${Date.now()}-${index}`,
                        name: findValue(columnMappings.name),
                        lastName: findValue(columnMappings.lastName),
                        phone: this.cleanPhoneNumber(findValue(columnMappings.phone)),
                        whatsapp: this.cleanPhoneNumber(findValue(columnMappings.whatsapp)),
                        telegram: this.cleanTelegramUsername(findValue(columnMappings.telegram)),
                    };

                    return contact;
                } catch (error) {
                    console.error('Error processing row:', error);
                    return null;
                }
            })
            .filter(contact => 
                contact && (contact.name || contact.lastName || contact.phone || contact.whatsapp || contact.telegram)
            );

        console.log(`Successfully processed ${contacts.length} contacts`);
        return contacts;
    }

    normalizeText(text) {
        if (!text) return '';
        return text.toString()
            .toLowerCase()
            .replace(/\s+/g, '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    cleanPhoneNumber(phone) {
        if (!phone) return '';
        
        let cleaned = phone.toString().replace(/[^\d+]/g, '');
        
        if (cleaned.startsWith('00')) {
            cleaned = '+' + cleaned.substring(2);
        }
        
        if (cleaned.startsWith('0') && !cleaned.startsWith('+')) {
            cleaned = '+963' + cleaned.substring(1);
        }
        
        const phoneRegex = /^[\+]?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(cleaned) || cleaned.length < 10) {
            return '';
        }
        
        return cleaned;
    }

    cleanTelegramUsername(username) {
        if (!username) return '';
        
        let cleaned = username.toString()
            .replace(/^@+/, '')
            .replace(/[^a-zA-Z0-9_]/g, '')
            .trim();
        
        return cleaned;
    }

    searchContacts() {
        const searchTerm = this.elements.searchInput?.value.trim() || '';
        
        if (!searchTerm) {
            this.filteredContacts = [...this.contacts];
        } else {
            const normalizedSearch = this.normalizeText(searchTerm);
            
            this.filteredContacts = this.contacts.filter(contact => {
                const searchFields = [
                    contact.name,
                    contact.lastName,
                    contact.phone,
                    contact.whatsapp,
                    contact.telegram,
                ].filter(Boolean);

                return searchFields.some(field => 
                    this.normalizeText(field).includes(normalizedSearch)
                );
            });
        }
        
        this.renderContacts();
    }

    renderContacts() {
        if (!this.elements.contactsContainer) {
            console.error('Contacts container not found');
            return;
        }

        if (this.filteredContacts.length === 0) {
            this.elements.contactsContainer.innerHTML = this.getEmptyStateHTML();
        } else {
            this.elements.contactsContainer.innerHTML = this.filteredContacts
                .map(contact => this.getContactCardHTML(contact))
                .join('');
        }
        
        this.updateContactsCount();
    }

    getContactCardHTML(contact) {
        const firstLetter = (contact.name || contact.lastName || '?').charAt(0).toUpperCase();
        const displayName = `${contact.name || ''} ${contact.lastName || ''}`.trim() || 'بدون اسم';
        
        return `
        <div class="contact-card" data-contact-id="${contact.id}">
            <div class="contact-avatar">
                ${firstLetter}
            </div>
            
            <div class="contact-info-horizontal">
                <h3 class="contact-name">${this.escapeHtml(displayName)}</h3>
                <div class="contact-details-grid">
                    ${this.getContactFieldHTML('fas fa-phone', contact.phone, 'رقم الهاتف')}
                    ${this.getContactFieldHTML('fab fa-whatsapp', contact.whatsapp, 'رقم الواتساب')}
                    ${this.getContactFieldHTML('fab fa-telegram', contact.telegram, 'حساب التليجرام', '@' + contact.telegram)}
                </div>
            </div>
            
            <div class="contact-actions-horizontal">
                ${this.getActionButtonHTML('call', 'اتصال', 'fas fa-phone', contact.phone)}
                ${this.getActionButtonHTML('whatsapp', 'واتساب', 'fab fa-whatsapp', contact.whatsapp)}
                ${this.getActionButtonHTML('telegram', 'تيليجرام', 'fab fa-telegram', contact.telegram)}
            </div>
        </div>
        `;
    }

    getContactFieldHTML(icon, value, label, displayValue = null) {
        if (!value) return '';
        
        const display = displayValue || value;
        
        return `
        <div class="contact-field-horizontal">
            <i class="${icon}"></i>
            <div class="contact-field-content">
                <span>${this.escapeHtml(display)}</span>
                <button class="copy-btn-small" 
                        data-copy-value="${value}"
                        data-copy-label="${label}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        `;
    }

    getActionButtonHTML(type, text, icon, value) {
        const isDisabled = !value;
        
        return `
        <button class="action-btn-horizontal ${type} ${isDisabled ? 'disabled' : ''}" 
                ${isDisabled ? 'disabled' : ''}
                data-action-type="${type}"
                data-action-value="${value}">
            <i class="${icon}"></i>
        </button>
        `;
    }

    getEmptyStateHTML() {
        const hasSearch = this.elements.searchInput?.value.trim() || '';
        
        return `
        <div class="empty-state">
            <i class="fas fa-${hasSearch ? 'search' : 'users'}"></i>
            <h3>${hasSearch ? 'لا توجد نتائج' : 'لا توجد جهات اتصال'}</h3>
            <p>${hasSearch ? 'جرب مصطلحات بحث مختلفة' : 'قم بالمزامنة لتحميل جهات الاتصال'}</p>
            ${!hasSearch ? `<button class="sync-btn-large" onclick="app.syncWithGitHub(true)">
                <i class="fas fa-sync"></i> مزامنة الآن
            </button>` : ''}
        </div>
        `;
    }

    handleAction(type, value) {
        if (!value) return;

        try {
            switch (type) {
                case 'call':
                    this.callNumber(value);
                    break;
                case 'whatsapp':
                    this.openWhatsApp(value);
                    break;
                case 'telegram':
                    this.openTelegram(value);
                    break;
            }
        } catch (error) {
            console.error('Action error:', error);
            this.showNotification('فشل تنفيذ الإجراء', 'error');
        }
    }

    callNumber(phone) {
        try {
            window.location.href = `tel:${phone}`;
            this.showNotification(`جاري الاتصال بالرقم ${phone}`, 'info', 2000);
        } catch (error) {
            this.showNotification('تعذر إجراء المكالمة', 'error');
        }
    }

    openWhatsApp(whatsapp) {
        try {
            const cleanNumber = whatsapp.replace(/[^\d+]/g, '');
            window.open(`https://wa.me/${cleanNumber}`, '_blank');
            this.showNotification(`جاري فتح واتساب`, 'info', 2000);
        } catch (error) {
            this.showNotification('تعذر فتح واتساب', 'error');
        }
    }

    openTelegram(telegram) {
        try {
            const cleanUsername = telegram.replace(/^@+/, '');
            window.open(`https://web.telegram.org/k/#@${cleanUsername}`, '_blank');
            this.showNotification(`جاري فتح تيليجرام`, 'info', 2000);
        } catch (error) {
            this.showNotification('تعذر فتح تيليجرام', 'error');
        }
    }

    async copyToClipboard(text, label) {
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification(`تم نسخ ${label}`, 'success', 2000);
        } catch (error) {
            this.showNotification('فشل نسخ النص', 'error');
        }
    }

    updateContactsCount() {
        if (this.elements.contactsCount) {
            const total = this.contacts.length;
            const filtered = this.filteredContacts.length;
            const countText = total === filtered ? 
                `${total} جهة اتصال` : 
                `${filtered} من ${total} جهة اتصال`;
            
            this.elements.contactsCount.textContent = countText;
        }
    }

    showNotification(message, type = 'info', duration = 5000) {
        if (!this.elements.notificationCenter) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <div class="notification-content">${message}</div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.elements.notificationCenter.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 10);
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('show');
        }
    }

    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('show');
        }
    }

    startAutoSync() {
        setInterval(() => {
            if (navigator.onLine && !this.isLoading) {
                this.syncWithGitHub();
            }
        }, this.config.syncInterval);
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('smartContactApp', JSON.stringify(this.contacts));
            localStorage.setItem('smartContactApp_timestamp', Date.now().toString());
        } catch (error) {
            console.error('Save to localStorage error:', error);
        }
    }

    loadSampleData() {
        const sampleContacts = [
            {
                id: 'sample-1',
                name: 'عمار قصاب',
                lastName: 'أبو رعد الحموي',
                phone: '+963934096914',
                whatsapp: '+963934096914',
                telegram: 'TF3RAAD'
            },
            {
                id: 'sample-2',
                name: 'محمد أحمد',
                phone: '+963123456789',
                whatsapp: '+963123456789'
            }
        ];
        
        this.contacts = sampleContacts;
        this.filteredContacts = [...this.contacts];
        this.saveToLocalStorage();
        this.renderContacts();
        this.showNotification('تم تحميل البيانات المحلية', 'info');
    }

    // دوال المساعدة
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ========== تهيئة التطبيق بعد المصادقة ==========
function initializeAppAfterAuth() {
    console.log('Initializing application after authentication');
    try {
        window.app = new SmartContactApp();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        // عرض رسالة خطأ في الواجهة
        const notificationCenter = document.getElementById('notificationCenter');
        if (notificationCenter) {
            const errorNotification = document.createElement('div');
            errorNotification.className = 'notification notification-error';
            errorNotification.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <div class="notification-content">خطأ في تحميل التطبيق</div>
            `;
            notificationCenter.appendChild(errorNotification);
        }
    }
}
