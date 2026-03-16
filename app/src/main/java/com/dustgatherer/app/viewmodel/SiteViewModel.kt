package com.dustgatherer.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.dustgatherer.app.data.model.Site
import com.dustgatherer.app.data.repository.SiteRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SiteViewModel(private val repository: SiteRepository) : ViewModel() {

    val sites: StateFlow<List<Site>> = repository.getAllSites()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun addSite(name: String, onResult: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            val success = repository.addSite(name)
            onResult(success)
        }
    }

    fun deleteSite(site: Site) {
        viewModelScope.launch {
            repository.deleteSite(site)
        }
    }

    companion object {
        fun provideFactory(repository: SiteRepository): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T {
                    return SiteViewModel(repository) as T
                }
            }
    }
}
