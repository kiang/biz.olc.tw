class BusinessInfoApp {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
        this.handleHashChange();
    }

    bindEvents() {
        window.addEventListener('hashchange', () => this.handleHashChange());
        window.addEventListener('load', () => this.handleHashChange());
        
        // Bind search form
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => this.handleSearch(e));
        }
    }

    handleHashChange() {
        const hash = window.location.hash;
        
        if (!hash || hash === '#') {
            this.showHomePage();
            return;
        }

        const parts = hash.substring(1).split('/');
        if (parts.length !== 2) {
            this.showError('網址格式錯誤，請使用 #company/編號 或 #business/編號');
            return;
        }

        const [type, id] = parts;
        
        if (type === 'company') {
            this.loadCompanyData(id);
            this.prefillSearchBar(id);
        } else if (type === 'business') {
            this.loadBusinessData(id);
            this.prefillSearchBar(id);
        } else {
            this.showError('類型錯誤，請使用 "company" 或 "business"');
        }
    }

    async loadCompanyData(id) {
        const url = `https://kiang.github.io/biz_companies/${id.charAt(0)}/${id}.json`;
        await this.loadData(url, 'company', id);
    }

    async loadBusinessData(id) {
        const url = `https://kiang.github.io/biz_business/${id.charAt(0)}/${id}.json`;
        await this.loadData(url, 'business', id);
    }

    async loadData(url, type, id) {
        this.showLoading();
        this.hideAllContent();

        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.hideLoading();
            
            if (type === 'company') {
                this.displayCompanyData(data);
            } else if (type === 'business') {
                this.displayBusinessData(data);
            }
            
        } catch (error) {
            this.hideLoading();
            let errorMessage = '';
            
            if (error.message.includes('404')) {
                if (type === 'company') {
                    errorMessage = `找不到統一編號 ${id} 的公司資料，請確認編號是否正確`;
                } else {
                    errorMessage = `找不到統一編號 ${id} 的商業資料，請確認編號是否正確`;
                }
            } else if (error.message.includes('403')) {
                errorMessage = '無權限存取此資料';
            } else if (error.message.includes('500')) {
                errorMessage = '伺服器發生錯誤，請稍後再試';
            } else if (error.message.includes('Network') || error.message.includes('fetch')) {
                errorMessage = '網路連線異常，請檢查網路連線';
            } else {
                errorMessage = `載入資料時發生錯誤：${error.message}`;
            }
            
            this.showError(errorMessage);
        }
    }

    displayCompanyData(data) {
        const companySection = document.getElementById('company-data');
        const detailsContainer = document.getElementById('company-details');
        
        // Set main company information
        document.getElementById('company-name').textContent = data['公司名稱'] || 'Company Name Not Available';
        document.getElementById('company-number-display').textContent = data.id || 'N/A';
        
        // Set overview section
        document.getElementById('company-status-overview').textContent = data['登記現況'] || 'N/A';
        document.getElementById('company-type-overview').textContent = data['組織類型'] || 'N/A';
        document.getElementById('company-incorporated-overview').textContent = 
            data['核准設立日期'] && typeof data['核准設立日期'] === 'object' && data['核准設立日期'].year ? 
            this.formatChineseDate(data['核准設立日期']) : 'N/A';
        
        // Set address
        document.getElementById('company-address-display').innerHTML = 
            this.formatAddress(data['公司所在地']) || 'N/A';
        
        // Clear existing detailed content
        detailsContainer.innerHTML = '';
        
        // Display all fields from JSON in details section
        Object.keys(data).forEach(key => {
            if (key === 'crawled_at') return; // Skip crawled_at field
            
            const row = document.createElement('div');
            row.className = 'govuk-summary-list__row';
            
            const keyCell = document.createElement('dt');
            keyCell.className = 'govuk-summary-list__key';
            keyCell.textContent = key;
            
            const valueCell = document.createElement('dd');
            valueCell.className = 'govuk-summary-list__value';
            
            let value = data[key];
            
            // Handle different data types
            if (key.includes('日期') || key.includes('變更')) {
                if (typeof value === 'object' && value.year) {
                    value = this.formatChineseDate(value);
                }
            } else if (key === '所營事業資料') {
                if (typeof value === 'object') {
                    const businesses = Object.values(value).filter(v => v && typeof v === 'string' && v.trim());
                    value = businesses.join('<br>');
                    valueCell.innerHTML = value;
                } else {
                    valueCell.textContent = value || 'N/A';
                }
                row.appendChild(keyCell);
                row.appendChild(valueCell);
                detailsContainer.appendChild(row);
                return;
            } else if (key === '董監事名單' || key === '經理人名單') {
                if (Array.isArray(value)) {
                    const members = value.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            const entries = [];
                            if (item['序號']) entries.push(`序號: ${item['序號']}`);
                            if (item['姓名']) entries.push(`姓名: ${item['姓名']}`);
                            if (item['職稱']) entries.push(`職稱: ${item['職稱']}`);
                            if (item['所代表法人']) entries.push(`所代表法人: ${item['所代表法人']}`);
                            if (item['出資額']) entries.push(`出資額: ${item['出資額']}`);
                            return entries.join(', ');
                        }
                        return item;
                    }).filter(item => item && item.toString().trim() !== '');
                    
                    if (members.length > 0) {
                        value = members.join('<br><br>');
                        valueCell.innerHTML = value;
                    } else {
                        valueCell.textContent = 'N/A';
                    }
                } else {
                    valueCell.textContent = 'N/A';
                }
                row.appendChild(keyCell);
                row.appendChild(valueCell);
                detailsContainer.appendChild(row);
                return;
            } else if (Array.isArray(value)) {
                const arrayItems = value.filter(item => item !== null && item !== undefined && item !== '');
                if (arrayItems.length === 0) {
                    value = 'N/A';
                } else {
                    value = arrayItems.map(item => {
                        if (typeof item === 'object') {
                            return JSON.stringify(item, null, 2);
                        }
                        return item;
                    }).join(', ');
                }
            } else if (typeof value === 'object') {
                value = JSON.stringify(value, null, 2);
            }
            
            valueCell.textContent = value || 'N/A';
            
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            detailsContainer.appendChild(row);
        });
        
        companySection.style.display = 'block';
    }

    displayBusinessData(data) {
        const businessSection = document.getElementById('business-data');
        const detailsContainer = document.getElementById('business-details');
        
        // Set main business information
        document.getElementById('business-name').textContent = data['商業名稱'] || 'Business Name Not Available';
        document.getElementById('business-number-display').textContent = data.id || 'N/A';
        
        // Set overview section
        document.getElementById('business-status-overview').textContent = data['登記現況'] || 'N/A';
        document.getElementById('business-type-overview').textContent = data['組織類型'] || 'N/A';
        document.getElementById('business-registered-overview').textContent = 
            data['核准設立日期'] && typeof data['核准設立日期'] === 'object' && data['核准設立日期'].year ? 
            this.formatChineseDate(data['核准設立日期']) : 'N/A';
        
        // Set address
        document.getElementById('business-address-display').innerHTML = 
            this.formatAddress(data['地址']) || 'N/A';
        
        // Clear existing detailed content
        detailsContainer.innerHTML = '';
        
        // Display all fields from JSON in details section
        Object.keys(data).forEach(key => {
            if (key === 'crawled_at') return; // Skip crawled_at field
            
            const row = document.createElement('div');
            row.className = 'govuk-summary-list__row';
            
            const keyCell = document.createElement('dt');
            keyCell.className = 'govuk-summary-list__key';
            keyCell.textContent = key;
            
            const valueCell = document.createElement('dd');
            valueCell.className = 'govuk-summary-list__value';
            
            let value = data[key];
            
            // Handle different data types
            if (key.includes('日期') || key.includes('變更')) {
                if (typeof value === 'object' && value.year) {
                    value = this.formatChineseDate(value);
                }
            } else if (key === '營業項目') {
                if (typeof value === 'object' && value.raw_data) {
                    value = value.raw_data;
                }
            } else if (key === '出資額(元)') {
                if (Array.isArray(value)) {
                    const investments = value.map(item => {
                        if (typeof item === 'object' && item !== null) {
                            return Object.entries(item).map(([name, amount]) => `${name}: ${amount}`).join(', ');
                        }
                        return item;
                    }).filter(item => item && item.trim && item.trim() !== '');
                    
                    if (investments.length > 0) {
                        value = investments.join('<br>');
                        valueCell.innerHTML = value;
                    } else {
                        valueCell.textContent = 'N/A';
                    }
                } else if (typeof value === 'object' && value !== null) {
                    const entries = Object.entries(value).map(([name, amount]) => `${name}: ${amount}`).join('<br>');
                    valueCell.innerHTML = entries || 'N/A';
                } else {
                    valueCell.textContent = value || 'N/A';
                }
                row.appendChild(keyCell);
                row.appendChild(valueCell);
                detailsContainer.appendChild(row);
                return;
            } else if (Array.isArray(value)) {
                value = value.length > 0 ? value.join(', ') : 'N/A';
            } else if (typeof value === 'object') {
                value = JSON.stringify(value, null, 2);
            }
            
            valueCell.textContent = value || 'N/A';
            
            row.appendChild(keyCell);
            row.appendChild(valueCell);
            detailsContainer.appendChild(row);
        });
        
        businessSection.style.display = 'block';
    }

    formatDate(dateString) {
        if (!dateString) return null;
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    formatChineseDate(dateObj) {
        if (!dateObj || typeof dateObj !== 'object') return null;
        
        const { year, month, day } = dateObj;
        if (!year || !month || !day) return null;
        
        // Format as YYYY-MM-DD
        const paddedMonth = month.toString().padStart(2, '0');
        const paddedDay = day.toString().padStart(2, '0');
        return `${year}-${paddedMonth}-${paddedDay}`;
    }

    formatAddress(address) {
        if (!address) return null;
        
        if (typeof address === 'string') {
            return address.replace(/\n/g, '<br>');
        }
        
        if (typeof address === 'object') {
            const parts = [];
            
            if (address.premises) parts.push(address.premises);
            if (address.address_line_1) parts.push(address.address_line_1);
            if (address.address_line_2) parts.push(address.address_line_2);
            if (address.locality) parts.push(address.locality);
            if (address.region) parts.push(address.region);
            if (address.postal_code) parts.push(address.postal_code);
            if (address.country) parts.push(address.country);
            
            return parts.filter(part => part && part.trim()).join('<br>');
        }
        
        return address.toString();
    }

    showHomePage() {
        this.hideAllContent();
        document.getElementById('content').style.display = 'block';
        this.clearSearchBar();
    }

    prefillSearchBar(id) {
        const searchInput = document.getElementById('business-id');
        if (searchInput) {
            searchInput.value = id;
        }
    }

    clearSearchBar() {
        const searchInput = document.getElementById('business-id');
        if (searchInput) {
            searchInput.value = '';
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error').style.display = 'block';
    }

    hideError() {
        document.getElementById('error').style.display = 'none';
    }

    hideAllContent() {
        document.getElementById('content').style.display = 'none';
        document.getElementById('company-data').style.display = 'none';
        document.getElementById('business-data').style.display = 'none';
        this.hideError();
        this.hideSearchStatus();
    }

    async handleSearch(event) {
        event.preventDefault();
        
        const businessIdInput = document.getElementById('business-id');
        const businessId = businessIdInput.value.trim();
        
        // Validate input
        if (!businessId) {
            this.showError('請輸入統一編號');
            return;
        }
        
        if (businessId.length !== 8 || !/^\d{8}$/.test(businessId)) {
            this.showError('統一編號必須為8位數字');
            return;
        }
        
        this.hideError();
        this.showSearchStatus('正在搜尋...');
        
        // Try to find the ID in both company and business APIs
        const found = await this.searchInBothTypes(businessId);
        
        if (found) {
            // Found data, redirect to the appropriate hash
            window.location.hash = found;
            this.hideSearchStatus();
        } else {
            this.hideSearchStatus();
            this.showError(`找不到統一編號 ${businessId} 的資料，請確認編號是否正確`);
        }
    }

    async searchInBothTypes(id) {
        // Try company first
        try {
            const companyUrl = `https://kiang.github.io/biz_companies/${id.charAt(0)}/${id}.json`;
            const companyResponse = await fetch(companyUrl);
            if (companyResponse.ok) {
                return `company/${id}`;
            }
        } catch (error) {
            // Continue to try business
        }
        
        // Try business
        try {
            const businessUrl = `https://kiang.github.io/biz_business/${id.charAt(0)}/${id}.json`;
            const businessResponse = await fetch(businessUrl);
            if (businessResponse.ok) {
                return `business/${id}`;
            }
        } catch (error) {
            // Not found in either
        }
        
        return null;
    }

    showSearchStatus(message) {
        document.getElementById('search-status-text').textContent = message;
        document.getElementById('search-status').style.display = 'block';
    }

    hideSearchStatus() {
        document.getElementById('search-status').style.display = 'none';
    }

    hideAllContent() {
        document.getElementById('content').style.display = 'none';
        document.getElementById('company-data').style.display = 'none';
        document.getElementById('business-data').style.display = 'none';
        this.hideError();
        this.hideSearchStatus();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BusinessInfoApp();
});