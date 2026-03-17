package com.dustgatherer.app.data.local

import androidx.room.*
import com.dustgatherer.app.data.model.Site
import kotlinx.coroutines.flow.Flow

@Dao
interface SiteDao {
    @Query("SELECT * FROM sites ORDER BY name ASC")
    fun getAllSites(): Flow<List<Site>>

    @Query("SELECT * FROM sites ORDER BY name ASC")
    suspend fun getAllSitesSnapshot(): List<Site>

    @Query("SELECT * FROM sites WHERE name = :name LIMIT 1")
    suspend fun getSiteByName(name: String): Site?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSite(site: Site): Long

    @Delete
    suspend fun deleteSite(site: Site)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertSites(sites: List<Site>): List<Long>
}
