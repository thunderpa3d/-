// تطبيق دليل الاتصال الذكي - إصدار بدون إحصائيات
class SmartContactApp {
    constructor() {
        this.contacts = [];
        this.filteredContacts = [];
        this.config = {
            githubUrl: 'https://raw.githubusercontent.com/thunderpa3d/-/main/CONTACTS.xlsx',
            syncInterval: 60
        };
        
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.loadApp();
    }

    cacheElements() {
        this.elements = {
            contactsContainer: document.getElementById('contactsContainer'),
            searchInput: document.getElementById('searchInput'),
            clearSearch: document.getElementById('clearSearch'),
            syncStatus: document.getElementById('syncStatus'),
            notificationCenter: document.getElementById('notificationCenter'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            manualSync: document.getElementById('manualSync')
        };
    }

    bindEvents() {
        // Search functionality
        this.elements.searchInput.addEventListener('input', this.debounce(() => {
            this.searchContacts();
        }, 300));

        this.elements.clearSearch.addEventListener('click', () => {
            this.elements.searchInput.value = '';
            this.searchContacts();
            this.toggleClearButton();
        });

        // Manual sync
        this.elements.manualSync.addEventListener('click', () => {
            this.syncWithGitHub();
        });

        // Online/offline detection
        window.addEventListener('online', () => {
            this.updateSyncStatus('متصل بالإنترنت - جاري المزامنة...', 'syncing');
            setTimeout(() => this.syncWithGitHub(), 1000);
        });

        window.addEventListener('offline', () => {
            this.updateSyncStatus('غير متصل بالإنترنت', 'offline');
        });
    }

    async loadApp() {
        this.showLoading();
        
        try {
            await this.loadContacts();
            this.renderContacts();
            
            if (navigator.onLine) {
                await this.syncWithGitHub();
            }
        } catch (error) {
            this.showNotification('خطأ في تحميل التطبيق', 'error');
            console.error('App load error:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadContacts() {
        const savedContacts = localStorage.getItem('smartContactApp');
        const lastSync = localStorage.getItem('lastSyncTime');
        
        if (savedContacts) {
            this.contacts = JSON.parse(savedContacts);
            this.filteredContacts = [...this.contacts];
            
            if (lastSync) {
                const lastSyncTime = new Date(lastSync);
                this.updateSyncStatus('آخر تحديث: ' + this.formatTime(lastSyncTime), 'success');
            } else {
                this.updateSyncStatus('تم تحميل البيانات المحلية', 'success');
            }
        }
    }

    async syncWithGitHub() {
        this.updateSyncStatus('جاري المزامنة...', 'syncing');
        
        try {
            const response = await fetch(this.config.githubUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            if (jsonData.length === 0) {
                throw new Error('الملف لا يحتوي على بيانات');
            }
            
            this.processExcelData(jsonData);
            this.saveToLocalStorage();
            this.filteredContacts = [...this.contacts];
            this.renderContacts();
            
            this.updateSyncStatus('تمت المزامنة بنجاح', 'success');
            this.showNotification(`تم تحديث ${this.contacts.length} جهة اتصال`, 'success');
            
        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus('فشلت المزامنة', 'error');
            
            if (this.contacts.length === 0) {
                this.showNotification('فشل تحميل البيانات', 'error');
            } else {
                this.showNotification('تم استخدام البيانات المحلية', 'warning');
            }
        }
    }

    processExcelData(jsonData) {
        this.contacts = jsonData.map((row, index) => {
            const getValue = (keys) => {
                for (let key of keys) {
                    const foundKey = Object.keys(row).find(k => 
                        k.toLowerCase().replace(/\s/g, '') === key.toLowerCase().replace(/\s/g, '')
                    );
                    if (foundKey && row[foundKey]) {
                        return String(row[foundKey]).trim();
                    }
                }
                return '';
            };

            return {
                id: index + 1,
                name: getValue(['الاسم', 'name', 'Name', 'اسم']),
                lastName: getValue(['اللقب', 'lastName', 'lastname', 'Last Name', 'لقب']),
                phone: getValue(['رقم الهاتف', 'phone', 'Phone', 'هاتف']),
                whatsapp: getValue(['رقم الواتساب', 'whatsapp', 'WhatsApp', 'واتساب']),
                telegram: getValue(['حساب التليجرام', 'telegram', 'Telegram', 'تليجرام', 'تيليجرام']),
                address: getValue(['العنوان', 'address', 'Address', 'عنوان'])
            };
        }).filter(contact => contact.name || contact.lastName || contact.phone);
    }

    searchContacts() {
        const searchTerm = this.elements.searchInput.value.toLowerCase().trim();
        this.toggleClearButton();
        
        if (!searchTerm) {
            this.filteredContacts = [...this.contacts];
        } else {
            this.filteredContacts = this.contacts.filter(contact => {
                const searchableText = `
                    ${contact.name || ''} 
                    ${contact.lastName || ''} 
                    ${contact.phone || ''} 
                    ${contact.whatsapp || ''} 
                    ${contact.telegram || ''} 
                    ${contact.address || ''}
                `.toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
        }
        
        this.renderContacts();
    }

    renderContacts() {
        if (this.filteredContacts.length === 0) {
            this.elements.contactsContainer.innerHTML = this.getEmptyStateHTML();
            return;
        }

        this.elements.contactsContainer.innerHTML = this.filteredContacts
            .map(contact => this.getHorizontalContactCardHTML(contact))
            .join('');
    }

    getHorizontalContactCardHTML(contact) {
        const firstLetter = (contact.name || contact.lastName || '?').charAt(0);
        const displayName = `${contact.name || ''} ${contact.lastName || ''}`.trim() || 'بدون اسم';
        const telegramValue = contact.telegram ? contact.telegram.replace('@', '').trim() : '';
        const telegramDisplay = telegramValue ? '@' + telegramValue : 'غير محدد';
        
        return `
        <div class="contact-card">
            <!-- Avatar Section -->
            <div class="contact-avatar">${firstLetter}</div>
            
            <!-- Info Section -->
            <div class="contact-info-horizontal">
                <div class="contact-name">${displayName}</div>
                <div class="contact-details-grid">
                    ${this.getHorizontalContactFieldHTML('phone', 'fas fa-phone', contact.phone, 'رقم الهاتف')}
                    ${this.getHorizontalContactFieldHTML('whatsapp', 'fab fa-whatsapp', contact.whatsapp, 'رقم الواتساب')}
                    ${this.getHorizontalContactFieldHTML('telegram', 'fab fa-telegram', telegramValue, 'حساب التليجرام', telegramDisplay)}
                    ${this.getHorizontalContactFieldHTML('address', 'fas fa-home', contact.address, 'العنوان')}
                </div>
            </div>
            
            <!-- Actions Section -->
            <div class="contact-actions-horizontal">
                ${this.getHorizontalActionButtonHTML('call', 'اتصل', 'fas fa-phone', contact.phone, 'callNumber')}
                ${this.getHorizontalActionButtonHTML('whatsapp', 'واتساب', 'fab fa-whatsapp', contact.whatsapp, 'openWhatsApp')}
                ${this.getHorizontalActionButtonHTML('telegram', 'تيليجرام', 'fab fa-telegram', telegramValue, 'openTelegram')}
            </div>
        </div>
        `;
    }

    getHorizontalContactFieldHTML(type, icon, value, label, displayValue = null) {
        if (!value) return '';
        
        const display = displayValue || value;
        return `
        <div class="contact-field-horizontal">
            <i class="${icon}"></i>
            <div class="contact-field-content">
                <span>${display}</span>
                <button class="copy-btn-small" onclick="app.copyToClipboard('${this.escapeHtml(value)}', '${label}')">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
        `;
    }

    getHorizontalActionButtonHTML(type, text, icon, value, action) {
        const disabled = !value ? 'disabled' : '';
        const onclick = value ? `app.${action}('${this.escapeHtml(value)}')` : '';
        
        return `
        <button class="action-btn-horizontal ${type}" ${disabled} onclick="${onclick}">
            <i class="${icon}"></i>
            <span>${text}</span>
        </button>
        `;
    }

    getEmptyStateHTML() {
        return `
        <div class="empty-state">
            <i class="fas fa-search"></i>
            <h3>لا توجد نتائج</h3>
            <p>جرب مصطلحات بحث مختلفة أو تحقق من اتصال الإنترنت للمزامنة</p>
        </div>
        `;
    }

    toggleClearButton() {
        const hasValue = this.elements.searchInput.value.length > 0;
        this.elements.clearSearch.classList.toggle('visible', hasValue);
    }

    updateSyncStatus(message, type = '') {
        this.elements.syncStatus.className = `sync-status ${type}`;
        this.elements.syncStatus.querySelector('.status-text').textContent = message;
    }

    // Utility methods
    showLoading() {
        this.elements.loadingOverlay.classList.add('show');
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('show');
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)} notification-icon"></i>
            <div class="notification-content">
                <div class="notification-title">${this.getNotificationTitle(type)}</div>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.elements.notificationCenter.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => notification.remove(), 300);
        }, duration);
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

    getNotificationTitle(type) {
        const titles = {
            success: 'تم بنجاح',
            error: 'خطأ',
            warning: 'تحذير',
            info: 'معلومة'
        };
        return titles[type] || 'إشعار';
    }

    debounce(func, wait) {
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(date) {
        return date.toLocaleString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Action methods
    callNumber(phone) {
        window.open(`tel:${phone}`);
    }

    openWhatsApp(whatsapp) {
        const cleanNumber = whatsapp.replace(/[^\d+]/g, '');
        window.open(`https://wa.me/${cleanNumber}`);
    }

    openTelegram(telegram) {
        const cleanUsername = telegram.replace(/[@]/g, '');
        window.open(`https://t.me/${cleanUsername}`);
    }

    copyToClipboard(text, label) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification(`تم نسخ ${label}`, 'success', 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showNotification(`تم نسخ ${label}`, 'success', 2000);
        });
    }

    saveToLocalStorage() {
        localStorage.setItem('smartContactApp', JSON.stringify(this.contacts));
        localStorage.setItem('lastSyncTime', new Date().toISOString());
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartContactApp();
});

// Service Worker Registration for PWA capabilities
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}