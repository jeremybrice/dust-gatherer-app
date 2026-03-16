package com.dustgatherer.app.data.repository

import com.dustgatherer.app.data.local.SiteDao
import com.dustgatherer.app.data.model.Site
import kotlinx.coroutines.flow.Flow

class SiteRepository(private val siteDao: SiteDao) {

    fun getAllSites(): Flow<List<Site>> = siteDao.getAllSites()

    suspend fun getAllSitesSnapshot(): List<Site> = siteDao.getAllSitesSnapshot()

    suspend fun addSite(name: String): Boolean {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return false
        if (siteDao.getSiteByName(trimmed) != null) return false
        siteDao.insertSite(Site(name = trimmed))
        return true
    }

    suspend fun deleteSite(site: Site) = siteDao.deleteSite(site)

    suspend fun insertSites(sites: List<Site>) = siteDao.insertSites(sites)
}
