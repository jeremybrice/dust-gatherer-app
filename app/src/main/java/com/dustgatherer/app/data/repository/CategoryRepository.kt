package com.dustgatherer.app.data.repository

import com.dustgatherer.app.data.local.CategoryDao
import com.dustgatherer.app.data.model.Category
import kotlinx.coroutines.flow.Flow

class CategoryRepository(private val categoryDao: CategoryDao) {

    fun getAllCategories(): Flow<List<Category>> = categoryDao.getAllCategories()

    suspend fun getAllCategoriesSnapshot(): List<Category> = categoryDao.getAllCategoriesSnapshot()

    suspend fun addCategory(name: String): Boolean {
        val trimmed = name.trim()
        if (trimmed.isBlank()) return false
        if (categoryDao.getCategoryByName(trimmed) != null) return false
        categoryDao.insertCategory(Category(name = trimmed))
        return true
    }

    suspend fun deleteCategory(category: Category) = categoryDao.deleteCategory(category)

    suspend fun insertCategories(categories: List<Category>) = categoryDao.insertCategories(categories)
}
